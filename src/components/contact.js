import React, { useState } from "react"
import { Thanks } from './thanks';

const encode = data => Object.keys(data)
    .map(key => encodeURIComponent(key) + "=" + encodeURIComponent(data[key]))
    .join("&")

const Contact = () => {
    const [message, setMessage] = useState("");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [honeypot, setHoneypot] = useState("");
    const [displayThanks, setDisplayThanks] = useState(false)

    const handleSubmit = e => {
        e.preventDefault()
        fetch("/", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: encode({
                "form-name": "contact",
                name,
                email,
                message,
                honeypot
            })
        }).then(() => {
            setEmail("")
            setName("")
            setMessage("")
            setDisplayThanks(true)

            const timer = setTimeout(() => setDisplayThanks(false), 5000)
            return () => clearTimeout(timer)
        }).catch(() => {
            setEmail("")
            setName("")
            setMessage("")
            setDisplayThanks(false)
        })
    }

    return <div className="bg-stone-900 py-8 lg:px-8 lg:rounded-t-2xl">
        <form name="contact" method="POST" netlify data-netlify="true" netlify-honeypot="bot-field" onSubmit={handleSubmit}>
            <input type="hidden" name="form-name" value="contact" />
            <p className="hidden">
                <label>Human check:
                    <input
                        name="bot-field"
                        onChange={e => setHoneypot(e.target.value)}
                        value={honeypot} />
                </label>
            </p>
            <h2 className="text-center text-4xl font-bold leading-tight my-4">Send a message</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                    <img className="w-full h-full" src="contact.svg" alt="Kontakt" title="Kontakt" />
                </div>
                <div>
                    <div className="mt-8 px-4">
                        <label htmlFor="name" className="uppercase text-sm font-bold">Name</label>
                        <input
                            id="name"
                            name="name"
                            type="text"
                            onChange={e => {
                                setName(e.target.value)
                            }}
                            value={name}
                            className="w-full bg-stone-300 text-gray-900 mt-2 p-3 rounded-lg focus:outline-none focus:shadow-outline" />
                    </div>
                    <div className="mt-8 px-4">
                        <label htmlFor="email" className="uppercase text-sm font-bold">Email</label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            onChange={e => {
                                setEmail(e.target.value)
                            }}
                            value={email}
                            className="w-full bg-stone-300 text-gray-900 mt-2 p-3 rounded-lg focus:outline-none focus:shadow-outline" />
                    </div>
                    <div className="mt-8 px-4">
                        <label htmlFor="message" className="uppercase text-sm font-bold">Message</label>
                        <textarea
                            id="message"
                            name="message"
                            onChange={e => {
                                setMessage(e.target.value)
                            }}
                            value={message}
                            className="w-full h-32 bg-stone-300 text-gray-900 mt-2 p-3 rounded-lg focus:outline-none focus:shadow-outline" />
                    </div>
                    <div className="mt-8 px-4 mb-8">
                        <button
                            id="sendMessage"
                            type="submit"
                            disabled={message.length === 0 || name.length === 0 || email.length === 0}
                            className="disabled:opacity-30 text-lg uppercase btn-primary bg-amber-200 text-gray-800 transition duration-500 ease-in-out focus:outline-none w-full focus:shadow-outline cursor-pointer hover:bg-amber-100 font-normal py-2 px-4 rounded-lg">
                            Send
                        </button>
                    </div>
                </div>
            </div>
        </form >
        {displayThanks && <Thanks displayThanks={(display) => setDisplayThanks(display)} />}
    </div>
}

export default Contact;