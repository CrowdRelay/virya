"use client"
import React from "react"
import { handleScroll } from "./scrollToTop/scroll"

const linkStyle = 'transition duration-500 ease-in-out hover:text-amber-200 text-amber-300 cursor-pointer'

const MainText = ({ contactRef }) => <div className="container lg:max-w-5xl 2xl:mb-28 mb-auto 2xl:mt-64 lg:px-20 px-4 py-4">
    <div className="lg:bg-opacity-50 lg:bg-black bg-opacity-30 bg-black rounded-2xl lg:p-16 p-10 border-white lg:mt-40 mt-20 lg:mb-32 mb-16 lg:mt-0 lg:mb-48">
        <h1 className="lg:text-6xl lg:text-2xl text-lg font-bold font-sans m-0 lg:leading-none">We are Virya, a modern metalcore band from Poland 👋</h1>
        <p className="lg:text-lg text-s text-justify w-full lg:my-4">Hi there! Check out our newest releases. If you are interested in booking or you just want to reach out to us, <span onClick={() => handleScroll(contactRef.current)} className={linkStyle}>don't hesitate to leave a message</span>. Enjoy! 💪</p>
    </div>
</div>

export default MainText