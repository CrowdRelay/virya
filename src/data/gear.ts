export type GearCopy = {
  en: string
  pl: string
}

export type GearItem = {
  id: string
  name: string
  category: GearCopy
  description: GearCopy
  thomannUrl: string
  featured?: boolean
}

/**
 * Keep this list deliberately conservative: only named pieces of equipment
 * that are part of the current VIRYA live rig / technical-rider setup.
 */
export const GEAR_ITEMS: GearItem[] = [
  {
    id: "quad-cortex",
    name: "Neural DSP Quad Cortex",
    category: { en: "Guitar processing", pl: "Procesor gitarowy" },
    description: {
      en: "The core of the VIRYA guitar live rig: tones, routing and consistent stage output in one unit.",
      pl: "Serce koncertowego rigu gitarowego VIRYA: brzmienia, routing i powtarzalny sygnał sceniczny w jednym urządzeniu.",
    },
    thomannUrl: "https://www.thomann.pl/neural_dsp_quad_cortex.htm",
    featured: true,
  },
  {
    id: "x32-rack",
    name: "Behringer X32 Rack",
    category: { en: "IEM / live control", pl: "IEM / kontrola live" },
    description: {
      en: "Our rack mixer for in-ear monitoring and repeatable show routing.",
      pl: "Nasz rackowy mikser do odsłuchów IEM i powtarzalnego routingu koncertowego.",
    },
    thomannUrl: "https://www.thomann.pl/behringer_x32_rack.htm",
  },
  {
    id: "art-s8-3-way",
    name: "ART S8-3-Way Microphone Splitter",
    category: { en: "Signal split", pl: "Split sygnału" },
    description: {
      en: "The splitter that lets our rack and the venue receive the same stage signals cleanly.",
      pl: "Splitter, dzięki któremu nasz rack i konsoleta venue dostają ten sam sygnał sceniczny.",
    },
    thomannUrl: "https://www.thomann.pl/art_s83way_mikrofon_splitter.htm",
  },
  {
    id: "sm58",
    name: "Shure SM58 LC",
    category: { en: "Vocals", pl: "Wokal" },
    description: {
      en: "A dependable dynamic vocal microphone used in our live setup.",
      pl: "Sprawdzony dynamiczny mikrofon wokalowy używany w naszym setupie koncertowym.",
    },
    thomannUrl: "https://www.thomann.pl/shure_sm58.htm",
  },
  {
    id: "roland-tm2",
    name: "Roland TM-2 Trigger Module",
    category: { en: "Drums", pl: "Perkusja" },
    description: {
      en: "The trigger module in our hybrid drum setup.",
      pl: "Moduł triggerów w naszym hybrydowym setupie perkusyjnym.",
    },
    thomannUrl: "https://www.thomann.pl/roland_tm_2_trigger_module.htm",
  },
  {
    id: "umc1820",
    name: "Behringer UMC1820",
    category: { en: "Fallback interface", pl: "Interfejs zapasowy" },
    description: {
      en: "Our compact fallback audio interface when the full live rack cannot be used.",
      pl: "Kompaktowy interfejs zapasowy na koncerty, na których nie możemy użyć pełnego racka.",
    },
    thomannUrl: "https://www.thomann.pl/behringer_umc1820.htm",
  },
]
