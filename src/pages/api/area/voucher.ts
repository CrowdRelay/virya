import type { APIRoute } from "astro"
import { randomBytes } from "node:crypto"
import Stripe from "stripe"
import { AREA_TOKEN_VALUE_PLN } from "../../../data/area"
import { mutateAreaWallet, type AreaVoucher } from "../../../server/areaLedger"
import {
  areaJson,
  getAreaWalletId,
  isSameOriginRequest,
  readSmallJson,
} from "../../../server/areaHttp"

export const prerender = false

const MAX_TOKENS_PER_VOUCHER = 5
const VOUCHER_LIFETIME_SECONDS = 60 * 60 * 24 * 365
const PROCESSING_LEASE_MS = 10 * 60 * 1000

class VoucherProvisionError extends Error {
  readonly safeToRefund: boolean
  readonly originalError: unknown

  constructor(message: string, originalError: unknown, safeToRefund = false) {
    super(message)
    this.name = "VoucherProvisionError"
    this.originalError = originalError
    this.safeToRefund = safeToRefund
  }
}

const isMissingStripeResource = (error: unknown) =>
  error instanceof Stripe.errors.StripeInvalidRequestError &&
  (error.statusCode === 404 || error.code === "resource_missing")

const isDefinitiveStripeRejection = (error: unknown) =>
  error instanceof Stripe.errors.StripeInvalidRequestError ||
  error instanceof Stripe.errors.StripeAuthenticationError ||
  error instanceof Stripe.errors.StripePermissionError

const retrieveCoupon = async (stripe: Stripe, couponId: string) => {
  try {
    const coupon = (await stripe.coupons.retrieve(couponId)) as
      | Stripe.Coupon
      | Stripe.DeletedCoupon
    return "deleted" in coupon && coupon.deleted ? null : coupon
  } catch (error) {
    if (isMissingStripeResource(error)) return null
    throw error
  }
}

const couponMatches = (
  coupon: Stripe.Coupon,
  couponId: string,
  reservation: AreaVoucher,
) =>
  coupon.id === couponId &&
  coupon.amount_off === reservation.valuePln * 100 &&
  coupon.currency === "pln" &&
  coupon.duration === "once" &&
  coupon.max_redemptions === 1 &&
  coupon.redeem_by === reservation.expiresAt &&
  (!coupon.metadata?.area_request ||
    coupon.metadata.area_request === reservation.requestId)

const couponIsRedeemable = (coupon: Stripe.Coupon, reservation: AreaVoucher) =>
  coupon.valid &&
  coupon.times_redeemed === 0 &&
  reservation.expiresAt > Math.floor(Date.now() / 1000)

const requireRedeemableCoupon = (
  coupon: Stripe.Coupon,
  reservation: AreaVoucher,
) => {
  if (!couponIsRedeemable(coupon, reservation)) {
    throw new VoucherProvisionError(
      "The Stripe coupon exists but is no longer redeemable.",
      null,
    )
  }
  return coupon
}

const getOrCreateCoupon = async (
  stripe: Stripe,
  couponId: string,
  reservation: AreaVoucher,
  walletId: string,
) => {
  const existing = await retrieveCoupon(stripe, couponId)
  if (existing) {
    if (!couponMatches(existing, couponId, reservation)) {
      throw new VoucherProvisionError(
        "Existing Stripe coupon does not match the voucher reservation.",
        null,
      )
    }
    return requireRedeemableCoupon(existing, reservation)
  }

  try {
    const created = await stripe.coupons.create(
      {
        id: couponId,
        amount_off: reservation.valuePln * 100,
        currency: "pln",
        duration: "once",
        max_redemptions: 1,
        name: `${reservation.tokens} VIRYA Credit${reservation.tokens === 1 ? "" : "s"}`,
        redeem_by: reservation.expiresAt,
        metadata: {
          area_request: reservation.requestId,
          area_wallet: walletId.slice(0, 8),
          virya_credits: String(reservation.tokens),
        },
      },
      { idempotencyKey: `area-coupon-${reservation.requestId}` },
    )
    if (!couponMatches(created, couponId, reservation)) {
      throw new VoucherProvisionError(
        "Stripe returned a coupon with unexpected properties.",
        null,
      )
    }
    return requireRedeemableCoupon(created, reservation)
  } catch (error) {
    if (error instanceof VoucherProvisionError) throw error

    try {
      const reconciled = await retrieveCoupon(stripe, couponId)
      if (reconciled) {
        if (!couponMatches(reconciled, couponId, reservation)) {
          throw new VoucherProvisionError(
            "Reconciled Stripe coupon does not match the reservation.",
            error,
          )
        }
        return requireRedeemableCoupon(reconciled, reservation)
      }

      throw new VoucherProvisionError(
        "Stripe rejected coupon creation.",
        error,
        isDefinitiveStripeRejection(error),
      )
    } catch (reconcileError) {
      if (reconcileError instanceof VoucherProvisionError) {
        throw reconcileError
      }
      throw new VoucherProvisionError(
        "Stripe coupon state could not be reconciled.",
        error,
      )
    }
  }
}

const promotionCouponId = (promotion: Stripe.PromotionCode) => {
  const coupon = promotion.promotion.coupon
  return typeof coupon === "string" ? coupon : coupon?.id
}

const promotionMatches = (
  promotion: Stripe.PromotionCode,
  couponId: string,
  reservation: AreaVoucher,
) =>
  promotion.code.toLowerCase() === reservation.code.toLowerCase() &&
  promotionCouponId(promotion) === couponId &&
  promotion.max_redemptions === 1 &&
  promotion.expires_at === reservation.expiresAt &&
  promotion.restrictions.minimum_amount === reservation.minimumOrderPln * 100 &&
  promotion.restrictions.minimum_amount_currency === "pln" &&
  (!promotion.metadata?.area_request ||
    promotion.metadata.area_request === reservation.requestId)

const promotionIsRedeemable = (
  promotion: Stripe.PromotionCode,
  reservation: AreaVoucher,
) =>
  promotion.active &&
  promotion.times_redeemed === 0 &&
  reservation.expiresAt > Math.floor(Date.now() / 1000)

const findPromotion = async (
  stripe: Stripe,
  couponId: string,
  reservation: AreaVoucher,
) => {
  const page = await stripe.promotionCodes.list({
    code: reservation.code,
    limit: 10,
  })
  const sameCode = page.data.filter(
    promotion =>
      promotion.code.toLowerCase() === reservation.code.toLowerCase(),
  )
  const match = sameCode.find(promotion =>
    promotionMatches(promotion, couponId, reservation),
  )
  if (match) {
    if (!promotionIsRedeemable(match, reservation)) {
      throw new VoucherProvisionError(
        "The Stripe promotion exists but is no longer redeemable.",
        null,
      )
    }
    return match
  }
  if (sameCode.length > 0) {
    throw new VoucherProvisionError(
      "The Stripe promotion code is already used by another promotion.",
      null,
    )
  }
  return null
}

const getOrCreatePromotion = async (
  stripe: Stripe,
  couponId: string,
  reservation: AreaVoucher,
  walletId: string,
) => {
  const existing = await findPromotion(stripe, couponId, reservation)
  if (existing) return existing

  try {
    const created = await stripe.promotionCodes.create(
      {
        promotion: { type: "coupon", coupon: couponId },
        code: reservation.code,
        expires_at: reservation.expiresAt,
        max_redemptions: 1,
        restrictions: {
          minimum_amount: reservation.minimumOrderPln * 100,
          minimum_amount_currency: "pln",
        },
        metadata: {
          area_request: reservation.requestId,
          area_wallet: walletId.slice(0, 8),
          virya_credits: String(reservation.tokens),
        },
      },
      { idempotencyKey: `area-promotion-${reservation.requestId}` },
    )
    if (!promotionMatches(created, couponId, reservation)) {
      throw new VoucherProvisionError(
        "Stripe returned a promotion with unexpected properties.",
        null,
      )
    }
    if (!promotionIsRedeemable(created, reservation)) {
      throw new VoucherProvisionError(
        "Stripe returned a promotion that is not redeemable.",
        null,
      )
    }
    return created
  } catch (error) {
    if (error instanceof VoucherProvisionError) throw error

    try {
      const reconciled = await findPromotion(stripe, couponId, reservation)
      if (reconciled) return reconciled

      throw new VoucherProvisionError(
        "Stripe rejected promotion-code creation.",
        error,
        isDefinitiveStripeRejection(error),
      )
    } catch (reconcileError) {
      if (reconcileError instanceof VoucherProvisionError) {
        throw reconcileError
      }
      throw new VoucherProvisionError(
        "Stripe promotion state could not be reconciled.",
        error,
      )
    }
  }
}

const publicVoucher = (voucher: AreaVoucher) => ({
  code: voucher.code,
  tokens: voucher.tokens,
  valuePln: voucher.valuePln,
  minimumOrderPln: voucher.minimumOrderPln,
  createdAt: voucher.createdAt,
  expiresAt: voucher.expiresAt,
})

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isSameOriginRequest(request)) {
    return areaJson({ error: "Invalid request origin" }, 403)
  }

  let body: any
  try {
    body = await readSmallJson(request)
  } catch {
    return areaJson({ error: "Invalid request" }, 400)
  }

  const tokens = Number(body?.tokens)
  const requestId =
    typeof body?.requestId === "string" ? body.requestId.toLowerCase() : ""

  if (
    !Number.isInteger(tokens) ||
    tokens < 1 ||
    tokens > MAX_TOKENS_PER_VOUCHER ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      requestId,
    )
  ) {
    return areaJson({ error: "Invalid voucher request" }, 400)
  }

  const stripeKey = import.meta.env.STRIPE_SECRET_KEY
  if (!stripeKey) {
    return areaJson({ error: "Merch rewards are not active yet." }, 503)
  }

  const walletId = getAreaWalletId(cookies)
  const code = `VIRYA-${randomBytes(6).toString("hex").toUpperCase()}`
  const processingId = randomBytes(16).toString("hex")
  const processingExpiresAt = Date.now() + PROCESSING_LEASE_MS
  const now = Math.floor(Date.now() / 1000)
  const expiresAt = now + VOUCHER_LIFETIME_SECONDS
  const valuePln = tokens * AREA_TOKEN_VALUE_PLN
  const minimumOrderPln = valuePln + AREA_TOKEN_VALUE_PLN

  let reservation: AreaVoucher

  try {
    const result = await mutateAreaWallet<{
      voucher: AreaVoucher | null
      insufficient: boolean
      ownsProcessingLease: boolean
    }>(walletId, wallet => {
      const existingIndex = wallet.vouchers.findIndex(
        voucher => voucher.requestId === requestId,
      )
      const existing =
        existingIndex >= 0 ? wallet.vouchers[existingIndex] : undefined
      if (existing?.status === "issued" || existing?.status === "failed") {
        return {
          wallet,
          result: {
            voucher: existing,
            insufficient: false,
            ownsProcessingLease: false,
          },
        }
      }
      if (existing?.status === "pending") {
        if (
          existing.processingId &&
          Number(existing.processingExpiresAt) > Date.now()
        ) {
          return {
            wallet,
            result: {
              voucher: existing,
              insufficient: false,
              ownsProcessingLease: false,
            },
          }
        }

        const resumedVoucher: AreaVoucher = {
          ...existing,
          processingId,
          processingExpiresAt,
        }
        const vouchers = [...wallet.vouchers]
        vouchers[existingIndex] = resumedVoucher
        return {
          wallet: { ...wallet, vouchers },
          result: {
            voucher: resumedVoucher,
            insufficient: false,
            ownsProcessingLease: true,
          },
        }
      }

      if (wallet.tokenBalance < tokens) {
        return {
          wallet,
          result: {
            voucher: null,
            insufficient: true,
            ownsProcessingLease: false,
          },
        }
      }

      const voucher: AreaVoucher = {
        requestId,
        code,
        tokens,
        valuePln,
        minimumOrderPln,
        createdAt: new Date().toISOString(),
        expiresAt,
        status: "pending",
        processingId,
        processingExpiresAt,
      }

      return {
        wallet: {
          ...wallet,
          tokenBalance: wallet.tokenBalance - tokens,
          vouchers: [...wallet.vouchers, voucher],
        },
        result: {
          voucher,
          insufficient: false,
          ownsProcessingLease: true,
        },
      }
    })

    if (result.insufficient || !result.voucher) {
      return areaJson(
        { error: "Not enough VIRYA Credits.", retryWithNewRequest: true },
        409,
      )
    }

    reservation = result.voucher
    if (reservation.status === "issued") {
      return areaJson({ ok: true, voucher: publicVoucher(reservation) })
    }
    if (reservation.status === "failed") {
      return areaJson(
        { error: "Create a new voucher request.", retryWithNewRequest: true },
        409,
      )
    }
    if (!result.ownsProcessingLease) {
      return areaJson(
        {
          error: "This voucher request is still processing. Try it again.",
          code: "VOUCHER_PENDING",
          retryWithNewRequest: false,
        },
        409,
      )
    }
  } catch (error) {
    console.error("[area-voucher:reserve]", error)
    return areaJson({ error: "Voucher temporarily unavailable" }, 503)
  }

  const stripe = new Stripe(stripeKey)
  const couponId = `virya_area_${requestId.replaceAll("-", "")}`

  try {
    const coupon = await getOrCreateCoupon(
      stripe,
      couponId,
      reservation,
      walletId,
    )
    const promotion = await getOrCreatePromotion(
      stripe,
      coupon.id,
      reservation,
      walletId,
    )

    const issued = await mutateAreaWallet<AreaVoucher | null>(
      walletId,
      wallet => {
        let finalVoucher: AreaVoucher | null = null
        const vouchers = wallet.vouchers.map(voucher => {
          if (voucher.requestId === requestId && voucher.status === "issued") {
            finalVoucher = voucher
            return voucher
          }
          if (
            voucher.requestId !== requestId ||
            voucher.status !== "pending" ||
            voucher.processingId !== processingId
          ) {
            return voucher
          }
          finalVoucher = {
            ...voucher,
            status: "issued",
            processingId: undefined,
            processingExpiresAt: undefined,
            couponId: coupon.id,
            promotionCodeId: promotion.id,
          }
          return finalVoucher
        })
        return {
          wallet: { ...wallet, vouchers },
          result: finalVoucher,
        }
      },
    )

    if (!issued || issued.status !== "issued") {
      throw new Error("Voucher processing lease was lost before finalization")
    }
    return areaJson({ ok: true, voucher: publicVoucher(issued) })
  } catch (error) {
    console.error("[area-voucher:stripe]", error)

    const safeToRefund =
      error instanceof VoucherProvisionError && error.safeToRefund
    let recovery = { refunded: false, retryReady: false }
    try {
      recovery = await mutateAreaWallet(walletId, wallet => {
        let refunded = false
        let retryReady = false
        const vouchers = wallet.vouchers.map(voucher => {
          if (
            voucher.requestId !== requestId ||
            voucher.status !== "pending" ||
            voucher.processingId !== processingId
          ) {
            return voucher
          }
          if (safeToRefund) {
            refunded = true
            return {
              ...voucher,
              status: "failed" as const,
              processingId: undefined,
              processingExpiresAt: undefined,
            }
          }
          retryReady = true
          return {
            ...voucher,
            processingId: undefined,
            processingExpiresAt: undefined,
          }
        })
        return {
          wallet: {
            ...wallet,
            tokenBalance:
              wallet.tokenBalance + (refunded ? reservation.tokens : 0),
            vouchers,
          },
          result: { refunded, retryReady },
        }
      })
    } catch (releaseError) {
      console.error("[area-voucher:release]", releaseError)
    }

    return areaJson(
      {
        error: recovery.refunded
          ? "Could not create the merch code. Your Credits were restored."
          : "Could not finish the merch code. Retry the same request; your Credits remain reserved.",
        code: recovery.refunded ? "VOUCHER_FAILED" : "VOUCHER_RETRY",
        retryWithNewRequest: recovery.refunded,
        retryReady: recovery.retryReady,
      },
      503,
    )
  }
}
