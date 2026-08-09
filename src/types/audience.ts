export type AudienceOverview = {
  active_fans: number
  marketing_consented_fans: number
  ticket_buyers: number
  attendees: number
  synesthesia_participants: number
  qualified_referrals: number
  paid_ticket_orders: number
}

export type AudienceFanCard = {
  id: string
  email: string
  display_name: string | null
  locale: string | null
  status: string
  created_at: string
  updated_at: string
  qualified_referrals: number
  event_interests: number
  attended_events: number
  paid_ticket_orders: number
  synesthesia_entries: number
}

export type AudienceFanDetail = {
  fan: AudienceFanCard
  acquisitions: Array<{ source: string; campaign_name: string | null; occurred_at: string }>
  event_interests: Array<{ event_slug: string; event_title: string; created_at: string }>
  attendance: Array<{ event_slug: string; event_title: string; status: string; redeemed_at: string | null }>
  ticket_purchases: Array<{
    order_reference: string
    event_slug: string
    event_title: string
    status: string
    currency: string
    amount_gross_minor: number
    amount_refunded_minor: number
    paid_at: string | null
  }>
  rewards: Array<{ reward_name: string; reward_type: string; status: string; created_at: string }>
  synesthesia: Array<{
    campaign_slug: string
    entered_at: string
    completed_at: string | null
    client_total_elapsed_ms: number | null
  }>
  tags: string[]
}

export type AudienceFilter = {
  statuses?: string[]
  city_slugs?: string[]
  min_qualified_referrals?: number | null
  interested_event_slugs?: string[]
  attended_event_slugs?: string[]
  purchased_event_slugs?: string[]
  synesthesia_completed?: boolean | null
  marketing_consent?: boolean | null
  tags_all?: string[]
}

export type AudienceSegment = {
  id: string
  slug: string
  name: string
  description: string | null
  filter: AudienceFilter
  active: boolean
  created_at: string
  updated_at: string
}

export type SegmentPreview = {
  segment: AudienceSegment
  total: number
  sample: AudienceFanCard[]
}

export type CommunicationCampaign = {
  id: string
  slug: string
  name: string
  channel: "email" | "push" | "in_app"
  segment_slug: string
  template_key: string
  subject: string | null
  content: Record<string, unknown>
  status: "draft" | "scheduled" | "completed" | "cancelled"
  scheduled_at: string | null
  dispatch_event_id: string | null
  recipient_count: number | null
  delivered_count: number | null
  failed_count: number | null
  completed_at: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
}

export type FunnelRow = {
  source: string
  acquired_fans: number
  active_fans: number
  ticket_buyers: number
  attendees: number
}

export type RevenueRow = {
  currency: string
  paid_orders: number
  gross_paid_minor: number
  refunded_minor: number
  after_refunds_minor: number
}

export type AudienceDashboard = {
  overview: AudienceOverview | null
  segments: AudienceSegment[]
  campaigns: CommunicationCampaign[]
  funnel: FunnelRow[]
  revenue: RevenueRow[]
  features: { communication_campaigns_enabled: boolean; mailer_enabled: boolean }
  degraded: { active: boolean; unavailable: string[] }
  generated_at: string
}
