import React, { useState } from 'react'
import { Link } from "gatsby"
import { useScrollPosition } from '@n8tb1t/use-scroll-position'
import { handleScroll } from './scrollToTop/scroll'
import { StaticImage } from 'gatsby-plugin-image'

const Navbar = ({ displayLinks, portfolioRef, showsRef, contactRef }) => {
    const [headerStyle, setHeaderStyle] = useState({
        transition: 'all 200ms ease-in'
    })

    useScrollPosition(
        ({ prevPos, currPos }) => {
            const isVisible = currPos.y > prevPos.y

            const shouldBeStyle = {
                visibility: isVisible ? 'visible' : 'hidden',
                transition: `all 200ms ${isVisible ? 'ease-in' : 'ease-out'}`,
                transform: isVisible ? 'none' : 'translate(0, -100%)'
            }

            if (JSON.stringify(shouldBeStyle) === JSON.stringify(headerStyle)) return

            setHeaderStyle(shouldBeStyle)
        },
        [headerStyle],
        null,
        false,
        200
    )

    return <nav style={{ ...headerStyle }} className="fixed top-0 right-0 left-0 p-3 z-20 bg-opacity-50 bg-black">
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
                        layout="fixed"
                        className="rounded-full my-2"
                    />
                </Link>
            </div>
            <div data-menu="true">
                <div className="flex items-center">
                    {displayLinks && <>
                    <Link to="/band"
                        className="cursor-pointer lg:px-4 px-2 py-2 text-lg rounded transition duration-500 ease-in-out hover:text-amber-300 hover:bg-stone-900"
                        title="Band">
                        <span>Band</span>
                    </Link>
                    <div onClick={() => handleScroll(portfolioRef.current)}
                        className="cursor-pointer lg:px-4 px-2 py-2 text-lg rounded transition duration-500 ease-in-out hover:text-amber-300 hover:bg-stone-900"
                        title="Portfolio">
                        <span>Portfolio</span>
                    </div>
                    <div onClick={() => handleScroll(showsRef.current)}
                        className="cursor-pointer lg:px-4 px-2 py-2 text-lg rounded transition duration-500 ease-in-out hover:text-amber-300 hover:bg-stone-900"
                        title="Shows">
                        <span>Shows</span>
                    </div>
                    <div onClick={() => handleScroll(contactRef.current)}
                        className="cursor-pointer lg:px-4 px-2 py-2 text-lg rounded transition duration-500 ease-in-out hover:text-amber-300 hover:bg-stone-900"
                        title="Contact">
                        <span>Contact</span>
                    </div>
                    </>}
                </div>
            </div>
        </div>
    </nav>
}

export default Navbar;