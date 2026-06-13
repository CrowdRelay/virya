"use client"
import React, { useState, useEffect, memo } from 'react'
import { handleScroll } from './scrollToTop/scroll'
import { StaticImage } from 'gatsby-plugin-image'
import { Link } from 'gatsby'

const NavLink = memo(({ onClick, title, children }) => (
  <button
    onClick={onClick}
    className="cursor-pointer lg:px-4 px-2 py-2 text-xs font-semibold uppercase tracking-widest transition duration-300 ease-in-out text-zinc-400 hover:text-amber-400"
    title={title}
  >
    <span>{children}</span>
  </button>
));

const Navbar = ({ displayLinks, portfolioRef, musicRef, showsRef, contactRef }) => {
  const [headerStyle, setHeaderStyle] = useState({
    transition: 'all 200ms ease-in'
  })

  useEffect(() => {
    let lastY = window.scrollY
    let timeoutId = null

    const onScroll = () => {
      if (timeoutId) return
      timeoutId = setTimeout(() => {
        const currY = window.scrollY
        const isVisible = currY < lastY
        setHeaderStyle(prev => {
          const next = {
            visibility: isVisible ? 'visible' : 'hidden',
            transition: `all 200ms ${isVisible ? 'ease-in' : 'ease-out'}`,
            transform: isVisible ? 'none' : 'translate(0, -100%)'
          }
          return JSON.stringify(next) === JSON.stringify(prev) ? prev : next
        })
        lastY = currY
        timeoutId = null
      }, 200)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [])

  return (
    <nav style={{ ...headerStyle }} className="fixed top-0 right-0 left-0 p-3 z-20 backdrop-blur-md bg-black/70 border-b border-white/5">
      <div className="container mx-auto flex items-center">
        <div className="flex-1 flex lg:visible items-center">
            <Link title="Homepage" className="flex" to="/">
                <StaticImage
                    src="../images/virya.webp"
                    title="Virya"
                    loading='eager'
                    alt='Virya'
                    placeholder="blurred"
                    width={50}
                    height={50}
                    className="rounded-full my-2"
                />
          </Link>
        </div>
        <div data-menu="true">
          <div className="flex items-center">
            {displayLinks && (
              <>
                <Link to="/band"
                  className="cursor-pointer lg:px-4 px-2 py-2 text-xs font-semibold uppercase tracking-widest transition duration-300 ease-in-out text-zinc-400 hover:text-amber-400"
                >
                  Band
                </Link>
                <NavLink onClick={() => handleScroll(portfolioRef.current)} title="Portfolio">
                  Portfolio
                </NavLink>
                <NavLink onClick={() => handleScroll(musicRef.current)} title="Music">
                  Music
                </NavLink>
                <NavLink onClick={() => handleScroll(showsRef.current)} title="Shows">
                  Shows
                </NavLink>
                <NavLink onClick={() => handleScroll(contactRef.current)} title="Contact">
                  Contact
                </NavLink>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

export default memo(Navbar);