import React, { useState, useEffect } from "react";
import './style.css';

export const handleScroll = ref => {
  window.scrollTo({ behavior: 'smooth', top: ref.offsetTop })
}

const toTop = (smooth = false) => {
  if (smooth) {
    window.scrollTo({
      top: 0,
    });
  } else {
    document.documentElement.scrollTop = 0;
  }
}

export const ScrollToTop = ({
  top = 20,
  smooth = false,
  viewBox = "0 0 256 256",
  svgPath = "M222.138,91.475l-89.6-89.6c-2.5-2.5-6.551-2.5-9.051,0l-89.6,89.6c-2.5,2.5-2.5,6.551,0,9.051s6.744,2.5,9.244,0L122,21.85  V249.6c0,3.535,2.466,6.4,6,6.4s6-2.865,6-6.4V21.85l78.881,78.676c1.25,1.25,2.992,1.875,4.629,1.875s3.326-0.625,4.576-1.875  C224.586,98.025,224.638,93.975,222.138,91.475z",
}) => {
  const [visible, setVisible] = useState(false);
  const onScroll = () => {
    setVisible(document.documentElement.scrollTop > top);
  };
  useEffect(() => {
    document.addEventListener("scroll", onScroll);
    return () => document.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      {visible && (
        <button
          aria-label="Scroll to top"
          className="z-20 scroll-to-top right-6 bottom-6 p-1 w-12 h-12 scroll-to-top-small lg:scroll-to-top-big bg-amber-200 hover:bg-amber-100 text-gray-800 border-2 border-gray-800 rounded-full"
          onClick={() => toTop(smooth)}
        >
          <svg fill="#1f2936" viewBox={viewBox}>
            <path d={svgPath} />
          </svg>
        </button>
      )}
    </>
  );
};
