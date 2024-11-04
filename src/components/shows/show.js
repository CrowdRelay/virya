import React from 'react'

const ShowItem = ({ item }) => {
    let baseStyles = "transform ease-in-out rounded-xl inset-0 opacity-75 hover:opacity-100 place-items-center flex flex-row p-2 cursor-pointer"
    let d = new Date(item.date);
    let today = new Date();
    let isToday = d.setHours(0,0,0,0) == today.setHours(0,0,0,0);
    let textDate = isToday ? 'Today - ' : 'Date - ';
    isToday ? baseStyles += " bg-red-500" : baseStyles += " bg-black";
    return <div className={baseStyles}>
        <h2 className="text-lg lg:text-2xl ml-2">{item.title}</h2>
        <div className='flex flex-row flex-grow place-items-center justify-end'>
            <h2 className="text-lg lg:text-2xl"><p className='inline'>{textDate}</p> {d.toLocaleDateString("pl-PL")}</h2>
            <a title="Event" href={item.event} rel="noreferrer" target="_blank"><button className="px-6 py-4 mx-2 my-2 btn-outline-primary transition duration-500 ease-in-out focus:outline-none focus:shadow-outline border border-amber-300 hover:bg-amber-200 text-amber-300 hover:text-black font-normal px-4 rounded">Event</button></a>
            {item.tickets && <a title="Tickets" href={item.tickets} rel="noreferrer" target="_blank"><button className="px-6 py-4 mx-2 my-2 btn-outline-primary transition duration-500 ease-in-out focus:outline-none focus:shadow-outline border border-amber-300 hover:bg-amber-200 text-amber-300 hover:text-black font-normal px-4 rounded">Tickets</button></a>}
        </div>
    </div>
}

export default ShowItem