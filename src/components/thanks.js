"use client"
import React, { memo } from "react"
import { useI18n } from "../i18n/I18nContext"

const CheckIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="100%"
    height="100%"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="feather feather-check-circle w-5 h-5 mx-2"
  >
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
    <polyline points="22 4 12 14.01 9 11.01"></polyline>
  </svg>
)

const CloseIcon = ({ onClick, label }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    className="ml-2 hover:text-amber-200 transition-colors"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="feather feather-x w-5 h-5"
    >
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  </button>
)

const Message = ({ title, body }) => (
  <div className="text-xl font-normal max-w-full flex-initial">
    <div className="py-2">
      {title}
      <div className="text-sm font-base">{body}</div>
    </div>
  </div>
)

export const Thanks = memo(({ displayThanks }) => {
  const { t } = useI18n()
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-20 right-2 shadow-2xl lg:top-24 lg:right-4 flex justify-center items-center m-1 font-medium py-2 px-3 text-black bg-amber-400 border border-amber-300"
    >
      <div slot="avatar">
        <CheckIcon />
      </div>
      <Message title={t("contact.thankTitle")} body={t("contact.thankBody")} />
      <div className="flex flex-auto flex-row-reverse">
        <div>
          <CloseIcon
            onClick={() => displayThanks(false)}
            label={t("contact.dismiss")}
          />
        </div>
      </div>
    </div>
  )
})
