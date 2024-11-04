"use client"
import React from 'react'
import ShowItem from './show'
import shows from './shows.json'

const Shows = () => {
    return <div className="bg-stone-900 py-8 lg:px-8 lg:rounded-b-2xl">
        <div className="text-center mb-8 mx-4">
            <p className="text-4xl font-bold leading-tight my-4">Shows</p>
            <p className="italic w-full my-4">Make sure you're not skipping our upcoming shows</p>
            <div className="grid grid-cols-1 gap-4 overflow-hidden relative my-8">
                {shows.map(item => <ShowItem key={item.link} item={item} />)}
            </div>
        </div>
    </div>
}

export default Shows