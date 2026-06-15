"use client"
import React, { useState } from "react"
import { Thanks } from './thanks';

const encode = data => Object.keys(data)
    .map(key => encodeURIComponent(key) + "=" + encodeURIComponent(data[key]))
    .join("&")

const Contact = () => {
    const [formData, setFormData] = useState({
        message: "",
        name: "", 
        email: "",
        honeypot: ""
    });
    const [displayThanks, setDisplayThanks] = useState(false);

    const handleChange = e => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const resetForm = () => {
        setFormData({
            message: "",
            name: "",
            email: "",
            honeypot: ""
        });
    };

    const handleSubmit = e => {
        e.preventDefault();
        fetch("/", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: encode({ "form-name": "contact", ...formData })
        }).then(() => {
            fetch("/api/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, message })
            }).then(r => {
                if (!r.ok) r.json().then(d => console.error("[contact] email API error:", d))
            }).catch(err => console.error("[contact] email API failed:", err))
            resetForm();
            setDisplayThanks(true);
            const timer = setTimeout(() => setDisplayThanks(false), 5000);
            return () => clearTimeout(timer);
        }).catch(() => {
            resetForm();
            setDisplayThanks(false);
        });
    };

    const { message, name, email, honeypot } = formData;

    return (
        <div className="py-16 lg:px-8 border-t border-zinc-800/60">
            <form name="contact" method="POST" netlify="true" data-netlify="true" netlify-honeypot="bot-field" onSubmit={handleSubmit}>
                <input type="hidden" name="form-name" value="contact" />
                <p className="hidden">
                    <label>Human check:
                        <input
                            name="bot-field"
                            onChange={handleChange}
                            value={honeypot} />
                    </label>
                </p>
                <div className="flex items-center gap-4 mb-2">
                    <h2 className="text-3xl font-black uppercase tracking-widest whitespace-nowrap text-white">Send a message</h2>
                    <div className="flex-1 h-px bg-zinc-800" />
                </div>
                <p className="text-zinc-400 text-xs uppercase tracking-widest mb-8">We read every message</p>
                <div className="grid grid-cols-1 gap-8">
                    <div>
                        <div className="mt-8 px-4">
                            <label htmlFor="name" className="uppercase text-xs font-semibold tracking-widest text-zinc-400">Name</label>
                            <input
                                id="name"
                                name="name"
                                type="text"
                                onChange={handleChange}
                                value={name}
                                className="w-full bg-zinc-800 text-zinc-100 border border-zinc-700 focus:border-amber-400 mt-2 p-3 outline-none transition-colors" />
                        </div>
                        <div className="mt-8 px-4">
                            <label htmlFor="email" className="uppercase text-xs font-semibold tracking-widest text-zinc-400">Email</label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                onChange={handleChange}
                                value={email}
                                className="w-full bg-zinc-800 text-zinc-100 border border-zinc-700 focus:border-amber-400 mt-2 p-3 outline-none transition-colors" />
                        </div>
                        <div className="mt-8 px-4">
                            <label htmlFor="message" className="uppercase text-xs font-semibold tracking-widest text-zinc-400">Message</label>
                            <textarea
                                id="message"
                                name="message"
                                onChange={handleChange}
                                value={message}
                                className="w-full h-32 bg-zinc-800 text-zinc-100 border border-zinc-700 focus:border-amber-400 mt-2 p-3 outline-none transition-colors resize-none" />
                        </div>
                        <div className="mt-8 px-4 mb-8">
                            <button
                                id="sendMessage"
                                type="submit"
                                disabled={message.length === 0 || name.length === 0 || email.length === 0}
                                className="disabled:opacity-30 disabled:cursor-not-allowed w-full bg-amber-400 text-black hover:bg-amber-300 uppercase tracking-widest font-bold text-sm py-3 px-4 transition-all duration-200 outline-none">
                                Send
                            </button>
                        </div>
                    </div>
                </div>
            </form>
            {displayThanks && <Thanks displayThanks={setDisplayThanks} />}
        </div>
    );
};

export default Contact;