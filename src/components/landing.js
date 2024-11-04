"use client"
import React, {useEffect, useState} from 'react';

export default function Landing() {
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);
    if (!mounted) {
        return null;
    }

    return <div className="absolute inset-0 bg-black opacity-80 group-hover:opacity-75 -z-100">
            <video className="w-auto min-w-full min-h-full max-w-none" autoPlay muted loop id="landingvid">
                <source src="rise.webm" type="video/webm"/>
            </video>
        </div>
}