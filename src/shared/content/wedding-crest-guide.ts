// Shared by the article, blog listing, homepage and sitemap. Keep these
// editorial dates tied to actual content changes, not request/build time.
export const weddingCrestGuide = {
  slug: 'how-to-create-a-wedding-crest',
  path: '/blog/how-to-create-a-wedding-crest',
  title: 'How to Create a Wedding Crest: A Step-by-Step Guide',
  description:
    'Learn how to create a wedding crest with meaningful symbols, colors, and initials. Follow the real design steps, review your artwork, and prepare it for print.',
  published: '2026-10-20',
  author: 'Wedding Crest Design Editorial Team',
  image: '/images/blog/wedding-crest/floral-example.webp',
  imageAlt:
    'Floral wedding crest from the Wedding Crest Design example library',
};

export const guideContents = [
  ['what-is-a-wedding-crest', 'What makes a wedding crest?'],
  ['before-you-start', 'Before you start'],
  ['how-to-create-a-wedding-crest', 'Follow the seven design steps'],
  ['review-and-refine', 'Review and refine the result'],
  ['worked-example', 'A worked design brief'],
  ['download-and-print', 'Download and prepare for print'],
  ['troubleshooting', 'Troubleshooting'],
  ['questions', 'Frequently asked questions'],
] as const;

export const guideFaqs = [
  {
    question: 'Do we need a shared surname to create a wedding crest?',
    answer:
      'No. You can use each partner’s first initial or both names. Choose an arrangement that represents you; a shared surname is not a requirement.',
  },
  {
    question: 'Can I start from a wedding crest example?',
    answer:
      'Yes. Choose a design in the example library to open the creator with a reference. Check the prefilled names and settings, replace them with your own, and review which choices are set to “Same as example.” The reference guides a new AI generation; it is not a guarantee of an identical result.',
  },
  {
    question: 'Is it free to create a wedding crest?',
    answer:
      'The current creator asks you to sign in before generating and offers three free watermarked previews for one wedding project. Watermark-free image-pack downloads require a purchase. Check the pricing page and your project screen for current terms and available generations.',
  },
  {
    question: 'Will I receive an editable SVG or a layered design file?',
    answer:
      'The current download is an image pack, not an editable vector or layered stationery template. Names and artwork are generated together. Check the download screen for available image formats, and have a designer prepare a separate vector file if your production method requires one.',
  },
  {
    question: 'Can I use the crest on a large welcome sign?',
    answer:
      'Only after checking the actual image dimensions at the intended print size with your printer. A good-looking screen preview or stationery mockup does not certify large-format print quality. Ask for a proof before ordering.',
  },
  {
    question: 'Does a wedding crest have to follow heraldic rules?',
    answer:
      'This guide uses “wedding crest” to mean a decorative wedding emblem. It does not describe a formal grant of arms or establish a right to historical family arms. You can create a personal emblem with your own initials, flowers, and meaningful motifs.',
  },
];
