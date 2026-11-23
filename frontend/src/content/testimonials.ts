// ---------------------------------------------------------------------------
// Testimonials (landing page).
//
// Every entry below is a SAMPLE: invented placeholder text with fictional names, there only to design the section.
// Samples are shown in local development (labelled "Sample") and NEVER in a production build: publishing invented
// reviews as if real people wrote them would mislead visitors (and break consumer-protection rules on fake reviews).
//
// To go live: replace these with real quotes you have permission to publish, and set `sample: false` (or remove the
// field) on each. The section appears on the public site as soon as at least one real testimonial exists.
// Don't add star ratings or Review structured data.
// ---------------------------------------------------------------------------

export type Testimonial = {
  quote: string;
  name: string;
  role: string;
  /** True for placeholder text. Samples never render in production. */
  sample?: boolean;
};

export const TESTIMONIALS: readonly Testimonial[] = [
  {
    quote: "I'd been sitting on the idea for a year. Seeing the actual threads where people complained about the problem made it real enough to start.",
    name: "Imogen Thackeray",
    role: "Solo founder, scheduling tool",
    sample: true,
  },
  {
    quote: "The report told me to research more before building. Annoying at the time, right in hindsight: the buyers I assumed weren't the ones complaining.",
    name: "Tobias Okonkwo-Reid",
    role: "Indie hacker",
    sample: true,
  },
  {
    quote: "Every finding links back to where it came from, so I could read the conversations myself instead of trusting a summary.",
    name: "Priyanka Desai-Holm",
    role: "Product designer, side project",
    sample: true,
  },
  {
    quote: "The first-10-customers plan pointed me at two forums I'd never heard of. My first three users came from one of them.",
    name: "Mateo Villanueva",
    role: "Founder, bookkeeping app for cafés",
    sample: true,
  },
  {
    quote: "I liked that it said what it couldn't find. A low-confidence score with reasons is more useful than a confident guess.",
    name: "Hanne Lindqvist",
    role: "Ex-PM, first-time founder",
    sample: true,
  },
  {
    quote: "Competitor monitoring caught a price change the week before our launch. We adjusted our pricing page that afternoon.",
    name: "Kwame Asante-Brook",
    role: "Co-founder, B2B SaaS",
    sample: true,
  },
  {
    quote: "The survey in the Validation Lab settled an argument with my co-founder in four days instead of four weeks.",
    name: "Sorcha Delaney",
    role: "Co-founder, HR tool",
    sample: true,
  },
  {
    quote: "I compared three ideas side by side and dropped the one I was most excited about. Probably saved me six months.",
    name: "Ravi Chandrasekar",
    role: "Weekend builder",
    sample: true,
  },
  {
    quote: "It's the first research tool that didn't just agree with me.",
    name: "Elif Yıldırım-Shaw",
    role: "Founder, language-learning app",
    sample: true,
  },
  {
    quote: "Pain points ranked by how many different people mentioned them, not by how loud one thread was. That changed my roadmap.",
    name: "Bastien Moreau-Clarke",
    role: "Technical founder",
    sample: true,
  },
];

/**
 * What the landing page may show: real testimonials always; samples only outside production (and labelled there).
 */
export function visibleTestimonials(all: readonly Testimonial[] = TESTIMONIALS, env = process.env.NODE_ENV): Testimonial[] {
  return all.filter((t) => !t.sample || env !== "production");
}
