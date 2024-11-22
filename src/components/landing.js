"use client"
import React, { memo } from 'react';

const Landing = memo(() => {
  return (
    <div className="absolute inset-0 bg-black lg:mt-0 mt-24 lg:p-0 opacity-80 group-hover:opacity-75 -z-100">
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
        <track 
          src="captions_en.vtt" 
          kind="captions" 
          srcLang="en" 
          label="English captions"
          default
        />
      </video>
    </div>
  );
});

export default Landing;