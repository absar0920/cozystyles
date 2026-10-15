/** Live `.iw-timeline`: grey 2px rail, green 12px dots, bold status + muted meta line. */
export function StatusTimeline({ events }: { events: { status: string; meta: string }[] }) {
  return (
    <ol className="m-0 list-none p-0">
      {events.map((e, i) => (
        <li
          key={i}
          className="relative ml-[7px] border-l-2 border-[#e5e7eb] pb-[18px] pl-7 last:pb-0 before:absolute before:-left-[7px] before:top-0.5 before:h-3 before:w-3 before:rounded-full before:bg-[#087443] before:content-['']"
        >
          <span className="block text-[15px] font-[750] leading-[1.4] text-[#111827]">{e.status}</span>
          <span className="mt-1 block text-[13px] leading-[1.4] text-[#6b7280]">{e.meta}</span>
        </li>
      ))}
    </ol>
  );
}
