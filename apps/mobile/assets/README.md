# Bloom assets

Phase and locket PNGs are copied unchanged from this repository's
`public/assets/phases/` and `public/assets/partner/` so Metro bundles the
existing web artwork locally. They are decorative and hidden from native
screen readers. The authorized server presentation remains the text source.

DM Sans regular/medium/semibold and DM Serif Display regular are static TTFs
from the Expo Google Fonts distribution (`expo/google-fonts`,
`font-packages/dm-sans/` and `font-packages/dm-serif-display/`). Their SIL Open
Font License texts are included in `fonts/`. The app loads these local files;
it does not fetch fonts or artwork from the network at runtime.
