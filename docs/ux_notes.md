# UX Notes (v0.1)

This document captures the initial look-and-feel principles for the Journal App.  
It defines the emotional tone, design language, and interaction philosophy that should guide all frontend development — current and future.

These notes are based on the responses in personality_of_the_app.md (2025-12-09) and will evolve as new features, ideas, and preferences emerge.

------------------------------------------------------------------------
1. PERSONALITY OF THE APP
------------------------------------------------------------------------

The Journal App should feel:

- **Minimalist**
- **Modern**
- **Timeless**
- **Relaxing**
- **Organized**

It should evoke:
- a sense of calm  
- the feeling of “everything is in one place and under control”  
- low stress  
- intuitive flow  

There should be no cognitive friction.  
Users should feel *invited* into the app, not overwhelmed.

The central UX goal:  
**Quiet confidence. A place you trust to hold your thoughts.**

------------------------------------------------------------------------
2. COLOR PALETTE
------------------------------------------------------------------------

Current direction:
- **Predominantly white**, clean workspace  
- **Very subtle color accents**  
- Light greys for structure  
- Accent colors should feel natural, muted, or earthy  

Notes:
- Orange is meaningful (poweroforange.net) but should be used sparingly — too strong as a primary UI accent.
- Earth-tone friendly accents:
  - muted orange
  - desaturated greens or blues
  - soft terracotta
  - neutral warm beige/taupe

Palette intent:
- breathable  
- non-distracting  
- timeless  
- reinforces “zen calm”  

Tags may use more vibrant color variants, but the core UI stays understated.

------------------------------------------------------------------------
3. TYPOGRAPHY
------------------------------------------------------------------------

Desired qualities:
- inviting  
- easy to read  
- modern  
- timeless  

Primary font direction:
- clean sans-serif (e.g., Inter, Roboto, SF Pro, Nunito Sans)
- slightly rounded or softly geometric
- consistent weight hierarchy (regular / medium / semibold)

No overly decorative or handwriting fonts.  
Clarity over personality.

------------------------------------------------------------------------
4. JOURNAL PAGE LOOK
------------------------------------------------------------------------

Keep existing style:
- a **subtle card**  
- clean rounded corners  
- **soft drop shadow** (not harsh)  
- floating but grounded  

This card should resemble:
- a modern writing “space”
- not a skeuomorphic paper page
- not a rigid UI box

The card is the visual anchor of the app.

------------------------------------------------------------------------
5. INTERACTION PHILOSOPHY
------------------------------------------------------------------------

Interactions should feel:

- **Smooth**
- **Lightly tactile**
- **Slightly playful**, but in a restrained way  
- Never chaotic or energetic  
- Never jerky or abrupt

Interaction spectrum:  
**Zen calm ←———●——→ Energetic**  
The app sits strongly toward **zen calm**.

Notes:
- Micro-animations are acceptable if they feel fluid and slow-breathing.
- Draggable actions (tags, future elements) should use easing curves, not sharp transitions.
- Nothing pops, flashes, or vibrates.  
- Confidence is quiet.

------------------------------------------------------------------------
6. TAGS UX FEEL
------------------------------------------------------------------------

Tags should be:

- **pill-shaped** (current direction)
- subtle in color and border
- legible, with white text
- visually present, but not screaming for attention

Their movement:
- smooth drag
- subtle scaling or shadow while dragging (optional)
- slight “glide” on release (micro-animation)
- no snapping or grid constraints unless explicitly added later

The goal:
**Tags should feel like soft sticky notes you can place anywhere.**

------------------------------------------------------------------------
7. NAVIGATION PHILOSOPHY
------------------------------------------------------------------------

Current direction:
- **Sidebar navigation**

The sidebar can:
- grow in complexity later (e.g., notebooks, filters, settings)
- support collapsible sections in the future
- be minimized or hidden for a cleaner workspace (future feature)

Other navigation options to consider later:
- top bar for global actions
- hidden or collapsible menus to reduce clutter
- optional command palette (later)
- keyboard shortcuts (later)

General rule:
**Show only what’s needed in this moment.**

------------------------------------------------------------------------
8. MOBILE UX PHILOSOPHY
------------------------------------------------------------------------

Mobile should be:
- a **lightweight companion**  
- quick to access  
- easy to read  
- uncluttered  

Primary mobile priorities:
1. Reading past entries  
2. Light browsing/searching  
3. Quick capture (future feature)  
4. Tag browsing if done without clutter  

Avoid:
- overloading small screens  
- dense sidebars  
- too many simultaneous interactions

------------------------------------------------------------------------
9. INTERACTION SPEED
------------------------------------------------------------------------

Preference:
- Explicit Save button (for now)
- Navigation should feel **flowing**, not “snappy fast”

Meaning:
- use light animations for view transitions
- avoid instant jarring switches
- prioritize smoothness over raw speed

Autosave may be introduced later under specific rules.

------------------------------------------------------------------------
10. EXTERNAL UX INSPIRATION
------------------------------------------------------------------------

User referenced Google Keep’s tiled note view for browsing/searching.

Take inspiration from:
- the airy spacing  
- the light-color cards  
- fast scanability  
- clean label presentation  

But maintain a more **calm + minimal aesthetic** than Keep’s vibrancy.

Potential future adaptation:
- a “tile mode” for viewing many entries at once (e.g., search results, browsing entries)
- cards arranged in a simple grid with predictable spacing

------------------------------------------------------------------------
11. UX NORTH STAR
------------------------------------------------------------------------

The Journal App must feel like:

- A calm sanctuary for thoughts  
- A timeless digital notebook  
- Free of clutter  
- Effortless to navigate  
- Modern, but not trendy  
- Designed for longevity  

Everything in the design should follow these principles:
- Reduce cognitive load  
- Support deep focus  
- Respect whitespace  
- Avoid unnecessary ornamentation  
- Reward exploration with clear behavior  
- Feel consistent and predictable  

------------------------------------------------------------------------
12. DO'S AND DON'TS
------------------------------------------------------------------------

DO:
- Use whitespace generously  
- Use subtle shadows only where needed  
- Favor soft colors over saturated tones  
- Keep interactions smooth and quiet  
- Use intuitive spacing and consistent sizing  
- Give tags a tactile, gentle movement  
- Maintain a sense of visual calm  

DON’T:
- Use harsh borders  
- Use loud or neon colors  
- Clutter the sidebar or main view  
- Add excessive animation or bounciness  
- Overcomplicate navigation  
- Introduce skeuomorphic elements (subject to future revision)  

------------------------------------------------------------------------
13. FUTURE AREAS TO CLARIFY
------------------------------------------------------------------------

As the app grows, revisit UX for:

- notebooks (how to present them beautifully)
- attachment management UX
- tile/grid view vs list view
- animations (timing, easing, when to use them)
- mobile-first constraints
- dark mode possibilities (later)
- sensory tone (stillness, calmness)

------------------------------------------------------------------------
End of File
------------------------------------------------------------------------
