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
            body: encode({
                "form-name": "contact",
                ...formData
            })
        }).then(() => {
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
        <div className="bg-stone-900 py-8 lg:px-8 lg:rounded-t-full">
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
                <h2 className="text-center text-4xl font-bold leading-tight my-4">Send a message</h2>
                <div className="grid grid-cols-1 gap-8">
                    <div>
                        <div className="mt-8 px-4">
                            <label htmlFor="name" className="uppercase text-sm font-bold">Name</label>
                            <input
                                id="name"
                                name="name"
                                type="text"
                                onChange={handleChange}
                                value={name}
                                className="w-full bg-stone-300 text-gray-900 mt-2 p-3 rounded-lg focus:outline-none focus:shadow-outline" />
                        </div>
                        <div className="mt-8 px-4">
                            <label htmlFor="email" className="uppercase text-sm font-bold">Email</label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                onChange={handleChange}
                                value={email}
                                className="w-full bg-stone-300 text-gray-900 mt-2 p-3 rounded-lg focus:outline-none focus:shadow-outline" />
                        </div>
                        <div className="mt-8 px-4">
                            <label htmlFor="message" className="uppercase text-sm font-bold">Message</label>
                            <textarea
                                id="message"
                                name="message"
                                onChange={handleChange}
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
            </form>
            {displayThanks && <Thanks displayThanks={setDisplayThanks} />}
        </div>
    );
};

export default Contact;