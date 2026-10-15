'use client';

export type OptionGroup = {
  /** Option position 0|1|2 → variant.option1|2|3 */
  index: number;
  name: string;
  values: string[];
  /** value → swatch colour (only for colour options). */
  swatches?: Record<string, string>;
};

/**
 * Live `.variations`: per option a legend "Size: 1 Seater" (13px, name 600) then either 48px
 * bordered blocks (3px radius, selected = filled #103a3a) or, for colour options, 38px round
 * swatches with an inset ring on the selected one. Sold-out combos stay clickable like live, but
 * get the live `.is-disabled` look: a #dedede diagonal strike, 40% content and a #dedede ring/border.
 */
export function VariantPicker({
  groups,
  selected,
  unavailable,
  onSelect,
}: {
  groups: OptionGroup[];
  selected: Record<number, string>;
  /** option position → values to render struck through (see `unavailableValues`). */
  unavailable?: Record<number, Set<string>>;
  onSelect: (index: number, value: string) => void;
}) {
  if (groups.length === 0) return null;
  return (
    <div className="variations">
      {groups.map((group) => {
        const current = selected[group.index] ?? '';
        const off = unavailable?.[group.index];
        return (
          <fieldset key={group.index} className="m-0 mb-5 border-0 p-0">
            <legend className="mb-[6px] p-0 text-[13px] font-semibold leading-[22.75px] tracking-[0.26px] text-accent">
              {group.name}: <span className="font-normal">{current}</span>
            </legend>
            {group.swatches ? (
              <div className="flex flex-wrap">
                {group.values.map((value) => {
                  const active = value === current;
                  const disabled = off?.has(value) ?? false;
                  return (
                    <button
                      key={value}
                      type="button"
                      title={value}
                      aria-label={value}
                      aria-pressed={active}
                      onClick={() => onSelect(group.index, value)}
                      className={`relative mb-[2px] mr-[2px] block h-[38px] w-[38px] cursor-pointer rounded-full border-2 border-transparent p-0 transition-transform duration-[250ms] ease-theme ${
                        active
                          ? disabled
                            ? 'shadow-[inset_0_0_0_1px_#dedede]'
                            : 'shadow-[inset_0_0_0_1px_#103a3a]'
                          : 'hover:scale-90'
                      } ${disabled ? 'overflow-hidden' : ''}`}
                    >
                      <span
                        className={`absolute left-[3px] top-[3px] h-7 w-7 rounded-full ${disabled ? 'opacity-40' : ''}`}
                        style={{ background: group.swatches?.[value] ?? '#ccc' }}
                      />
                      {disabled && <Strike />}
                    </button>
                  );
                })}
              </div>
            ) : (
              // live: inline labels separated by a 4.5px word space, plus margin-right 3px below 768
              <div className="flex flex-wrap gap-x-[4.5px]">
                {group.values.map((value) => {
                  const active = value === current;
                  const disabled = off?.has(value) ?? false;
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onSelect(group.index, value)}
                      className={`relative mb-[3px] mr-[3px] inline-flex h-12 cursor-pointer items-center justify-center rounded-btn border px-[15px] py-[5px] text-[13px] font-normal leading-[22.75px] tracking-[0.26px] transition-colors md:mr-0 duration-[250ms] ease-theme ${
                        active ? 'bg-accent text-white' : 'bg-transparent text-accent hover:bg-accent/[0.02]'
                      } ${disabled ? 'overflow-hidden border-formline' : 'border-accent'}`}
                    >
                      <span className={disabled ? 'opacity-40' : undefined}>{value}</span>
                      {disabled && <Strike />}
                    </button>
                  );
                })}
              </div>
            )}
          </fieldset>
        );
      })}
    </div>
  );
}

/** Live `.is-disabled + label::before`: a 2px #dedede diagonal across the label's padding box. */
function Strike() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 z-[1] h-full w-full bg-[linear-gradient(to_bottom_right,transparent_calc(50%_-_1px),#dedede,transparent_calc(50%_+_1px))] bg-no-repeat"
    />
  );
}
