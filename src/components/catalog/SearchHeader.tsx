/**
 * Live search `.page-header`: centred 64px "Search Results", a 420px search field pre-filled with the query (with
 * its magnifier button) and the "N results found for “q”" sentence. Live hid the sentence and the magnifier
 * behind a green "Show more" toggle (a quirk of the theme's read-more script); here they are always shown.
 */
export function SearchHeader({ q, summary }: { q: string; summary: string | null }) {
  return (
    <div className="flex min-h-[250px] items-center px-0 py-[30px] text-center md:p-[60px]">
      <div className="relative z-[5] mx-auto max-w-[720px] px-[15px] text-black md:px-10">
        <h1 className="mb-5 text-[46px] font-semibold leading-[54px] text-accent md:text-[54px] md:leading-[62px] lg:text-[64px] lg:leading-[72px]">Search Results</h1>
        <form action="/search" method="get" role="search" className="relative mb-[35px] inline-block w-full max-w-[420px] align-top">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search for anything"
            aria-label="Search for anything"
            autoComplete="off"
            className="m-0 box-border block h-[52px] w-full appearance-none rounded-btn border border-formline bg-transparent py-[17px] pl-[22px] pr-[50px] text-[13px] leading-none text-accent outline-none placeholder:text-accent/30 focus:border-accent [&::-webkit-search-cancel-button]:hidden"
          />
          <button type="submit" aria-label="Search" className="absolute bottom-0 right-0 top-0 flex w-[50px] cursor-pointer items-center justify-center border-0 bg-transparent p-0">
            <svg width="19" height="20" viewBox="0 0 19 20" fill="none" aria-hidden>
              <path
                d="M13 13.5L17.7495 18.5M15 8C15 11.866 11.866 15 8 15C4.13401 15 1 11.866 1 8C1 4.13401 4.13401 1 8 1C11.866 1 15 4.13401 15 8Z"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-accent"
              />
            </svg>
          </button>
        </form>
        {summary && <p className="m-0 text-[17px] leading-[29.75px]">{summary}</p>}
      </div>
    </div>
  );
}
