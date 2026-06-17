"use client"
import React, { memo } from 'react'
import { useI18n } from '../../i18n/I18nContext'

const Button = memo(({ title, href }) => (
  <a title={title} href={href} rel="noreferrer" target="_blank">
    <button className="lg:px-6 lg:py-4 p-2 mx-6 lg:my-8 my-4 btn-outline-primary transition duration-500 ease-in-out focus:outline-none focus:shadow-outline border border-amber-300 hover:bg-amber-200 text-amber-300 hover:text-black font-normal px-4 rounded">
      {title}
    </button>
  </a>
))

const ShowItem = memo(({ item }) => {
  const { t, lang } = useI18n()
  const date = new Date(item.date);
  const today = new Date();
  const normalizedDate = date.setHours(0,0,0,0);
  const normalizedToday = today.setHours(0,0,0,0);

  if (normalizedDate >= normalizedToday) {
    const isToday = normalizedDate === normalizedToday;
    const textDate = isToday ? t("shows.today") : t("shows.date");
    const locale = lang === "pl" ? "pl-PL" : "en-GB";
    const baseStyles = `transform ease-in-out rounded-xl inset-0 opacity-75 hover:opacity-100 place-items-center lg:flex lg:flex-row p-2 cursor-pointer text-white ${isToday ? 'bg-red-900' : 'bg-zinc-900/60'}`;

    return (
      <div className={baseStyles}>
        <h2 className="lg:text-2xl text-md lg:ml-2">{item.title}</h2>
        <div className='lg:flex lg:flex-row lg:flex-grow place-items-center justify-end'>
          <h2 className="lg:text-2xl lg:my-8 text-md">
            <p className='inline'>{textDate}</p> {date.toLocaleDateString(locale)}
          </h2>
          {item.event && <Button title={t("shows.event")} href={item.event} />}
          {item.tickets && <Button title={t("shows.tickets")} href={item.tickets} />}
        </div>
      </div>
    )
  }
  return null;
})

export default ShowItem