import React from 'react';

const Landing = () => (
    <div className="absolute inset-0 -z-100 lg:mt-0 mt-24">
        <video
            className="lg:w-auto lg:min-w-full lg:min-h-full lg:max-w-none object-cover h-full w-full"
            autoPlay
            muted
            loop
            playsInline
            id="landingvid"
            aria-label="Background video"
        >
            <source src="rise.webm" type="video/webm" />
            <track src="captions_en.vtt" kind="captions" srcLang="en" label="English captions" default />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80" />
    </div>
);

export default Landing;