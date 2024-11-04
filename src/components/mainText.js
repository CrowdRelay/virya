"use client"
import React from "react"
import { handleScroll } from "./scrollToTop/scroll"

const linkStyle = 'transition duration-500 ease-in-out hover:text-amber-200 text-amber-300 cursor-pointer'

const MainText = ({ contactRef }) => <div className="container lg:max-w-5xl lg:mb-12 mb-auto lg:mt-72 lg:px-20 px-4 py-4">
    <div className="lg:bg-opacity-50 lg:bg-black bg-opacity-30 bg-black rounded-2xl lg:p-16 p-10 border-white mt-40 mb-32 lg:mt-0 lg:mb-48">
        <h1 className="lg:text-6xl text-2xl font-bold font-sans m-0 lg:leading-none">We are Virya, a modern metalcore band from Poland 👋</h1>
        <p className="text-lg text-justify w-full lg:my-4">Hi there! Check out our newest releases. If you are interested in booking or you just want to reach out to us, <span onClick={() => handleScroll(contactRef.current)} className={linkStyle}>don't hesitate to leave a message</span>. Enjoy! 💪</p>
    </div>
</div>

export default MainText