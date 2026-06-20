"use client"
import React, { memo } from 'react'
import { Link } from 'gatsby'
import { useI18n } from '../../i18n/I18nContext'

const Button = memo(({ title, href, onClick }) => (
  <a title={title} href={href} rel="noreferrer" target="_blank" onClick={onClick}>
    <button className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] lg:px-6 lg:py-4 px-4 py-2 mx-3 lg:mx-6 my-3 lg:my-8 btn-outline-primary transition duration-500 ease-in-out focus:outline-none focus:shadow-outline border border-amber-300 hover:bg-amber-200 text-amber-300 hover:text-black font-normal rounded">
      {title}
    </button>
  </a>
))

const ShowItem = memo(({ item, gigSlug }) => {
  const { t, lang, lp } = useI18n()
  const date = new Date(item.date);
  const today = new Date();
  const normalizedDate = date.setHours(0,0,0,0);
  const normalizedToday = today.setHours(0,0,0,0);

  if (normalizedDate >= normalizedToday) {
    const isToday = normalizedDate === normalizedToday;
    const textDate = isToday ? t("shows.today") : t("shows.date");
    const locale = lang === "pl" ? "pl-PL" : "en-GB";
    const clickable = Boolean(gigSlug);
    const baseStyles = `transform ease-in-out rounded-xl inset-0 opacity-75 hover:opacity-100 place-items-center lg:flex lg:flex-row p-2 text-white ${clickable ? 'cursor-pointer' : ''} ${isToday ? 'bg-red-900' : 'bg-zinc-900/60'}`;

    const inner = (
      <div className={baseStyles}>
        <h2 className="lg:text-2xl text-md lg:ml-2">{item.title}</h2>
        <div className='lg:flex lg:flex-row lg:flex-grow place-items-center justify-end'>
          <h2 className="lg:text-2xl lg:my-8 text-md">
            <p className='inline'>{textDate}</p> {date.toLocaleDateString(locale)}
          </h2>
          {item.event && <Button title={t("shows.event")} href={item.event} onClick={e => e.stopPropagation()} />}
          {item.tickets && <Button title={t("shows.tickets")} href={item.tickets} onClick={e => e.stopPropagation()} />}
        </div>
      </div>
    );

    return clickable ? (
      <Link to={lp(`/shows/${gigSlug}`)} className="block">
        {inner}
      </Link>
    ) : (
      inner
    );
  }
  return null;
})

export default ShowItem