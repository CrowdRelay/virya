"use client"
import React, { memo } from "react"
import { Link } from "gatsby"
import { handleScroll } from "./scrollToTop/scroll"

const MainText = memo(({ contactRef }) => (
  <div className="container lg:max-w-4xl my-auto lg:px-20 px-6 py-4">
    <div className="border-l-4 border-amber-400 pl-6 lg:pl-8 mt-20 md:mt-48 lg:mt-0 lg:mb-48 mb-16 py-2">
      <p className="uppercase tracking-[0.3em] text-amber-400 text-xs font-bold mb-4">
        Modern Metalcore · Poland
      </p>
      <h1 className="m-0 [text-shadow:0_2px_24px_rgba(0,0,0,0.9)]">
        <span className="block lg:text-7xl md:text-5xl text-4xl font-black tracking-tight leading-none text-white uppercase">
          We are Virya
        </span>
        <span className="block lg:text-2xl md:text-xl text-base font-semibold tracking-wide text-zinc-300 mt-2 normal-case">
          a modern metalcore band from Poland
        </span>
      </h1>
      <p className="lg:text-base text-sm mt-6 text-zinc-300 max-w-lg leading-relaxed [text-shadow:0_1px_8px_rgba(0,0,0,0.9)]">
        Hi there! Check out our newest releases and grab some{" "}
        <Link
          to="/merch"
          className="text-amber-400 hover:text-amber-200 transition-colors underline underline-offset-2"
        >
          merch
        </Link>
        . If you are interested in booking or you just want to reach out to us,{" "}
        <button
          onClick={() => handleScroll(contactRef.current)}
          className="text-amber-400 hover:text-amber-200 transition-colors underline underline-offset-2"
          aria-label="Scroll to contact form"
        >
          don't hesitate to leave a message
        </button>
        . Enjoy! 💪
      </p>
    </div>
  </div>
))

export default MainText
