import { Topic, Subject } from './types';

const chemAtomic: Topic = {
  id: 'chem-atomic-1', subjectId: 'chemistry', title: 'Atomic Structure',
  description: 'Protons, neutrons, electrons, and how atoms are built.', ibLevel: 'MYP',
  notes: [
    { id: 'n1', heading: 'Sub-atomic Particles', body: 'Protons: nucleus, +1 charge, mass 1. Neutrons: nucleus, 0 charge, mass 1. Electrons: shells orbiting nucleus, −1 charge, nearly 0 mass. In a neutral atom, protons = electrons.' },
    { id: 'n2', heading: 'Atomic Number and Mass Number', body: 'Atomic number = number of protons (defines the element). Mass number = protons + neutrons. Neutrons = mass number − atomic number. Example: carbon-12 has 6 protons + 6 neutrons.' },
    { id: 'n3', heading: 'Electron Configuration', body: 'Electrons occupy shells: 1st holds 2, 2nd holds 8, 3rd holds 8. Fill lowest shells first. Example: sodium (atomic number 11) = 2, 8, 1. Outer shell electrons determine chemical reactivity.' },
  ],
  flashcards: [
    { id: 'f1', term: 'Atomic number', definition: 'Number of protons in the nucleus — uniquely identifies the element.', example: 'Oxygen has atomic number 8.' },
    { id: 'f2', term: 'Mass number', definition: 'Total protons + neutrons in the nucleus.', example: 'Carbon-12: 6 protons + 6 neutrons = 12.' },
    { id: 'f3', term: 'Isotopes', definition: 'Same element (same protons) but different number of neutrons.', example: 'Carbon-12 vs Carbon-14 (2 extra neutrons).' },
    { id: 'f4', term: 'Electron configuration', definition: 'Arrangement of electrons in shells.', example: 'Sodium (Na): 2, 8, 1.' },
    { id: 'f5', term: 'Nucleus', definition: 'Dense central core containing protons and neutrons.', example: undefined },
  ],
  questions: [
    { id: 'q1', stem: 'Atom: atomic number 8, mass number 16. How many neutrons?', choices: ['8', '16', '24', '6'], correctIndex: 0, explanation: 'Neutrons = 16 − 8 = 8 (oxygen atom).' },
    { id: 'q2', stem: 'What determines which element an atom is?', choices: ['Neutrons', 'Electrons', 'Protons', 'Mass number'], correctIndex: 2, explanation: 'The number of protons (atomic number) is unique to each element.' },
    { id: 'q3', stem: 'Electron configuration of aluminium (atomic number 13)?', choices: ['2, 8, 3', '2, 11', '3, 8, 2', '2, 8, 8'], correctIndex: 0, explanation: 'Shell 1: 2, shell 2: 8, shell 3: 3 = 2, 8, 3.' },
    { id: 'q4', stem: 'Isotopes have same protons but different:', choices: ['Electrons', 'Protons', 'Neutrons', 'Shells'], correctIndex: 2, explanation: 'Same element, different numbers of neutrons → different mass numbers.' },
    { id: 'q5', stem: 'In a neutral atom:', choices: ['protons = neutrons', 'protons = electrons', 'neutrons = electrons', 'mass = atomic number'], correctIndex: 1, explanation: 'Equal positive and negative charges cancel out.' },
  ],
};

const chemBonding: Topic = {
  id: 'chem-bonding-1', subjectId: 'chemistry', title: 'Chemical Bonding',
  description: 'Ionic, covalent, and metallic bonds — how and why atoms join together.', ibLevel: 'MYP',
  notes: [
    { id: 'n1', heading: 'Ionic Bonding', body: 'Electrons transfer from metal to non-metal. Metal loses electrons → positive ion (cation). Non-metal gains electrons → negative ion (anion). Opposite charges attract. Example: Na loses 1 electron to Cl → Na⁺Cl⁻ (sodium chloride). Forms giant lattice with high melting point.' },
    { id: 'n2', heading: 'Covalent Bonding', body: 'Atoms share pairs of electrons. Typically between two non-metals. One shared pair = single bond. Example: H₂O — each H shares one pair with O. O₂ has a double bond (two shared pairs). Simple molecular substances have low melting points.' },
    { id: 'n3', heading: 'Metallic Bonding', body: 'Metal atoms release outer electrons into a "sea of electrons." Positive metal ions held by attraction to free-moving (delocalised) electrons. This explains: conductivity (electrons move), malleability (layers slide), high melting point (strong attractions).' },
  ],
  flashcards: [
    { id: 'f1', term: 'Ionic bond', definition: 'Electrostatic attraction between oppositely charged ions from electron transfer.', example: 'Na⁺ and Cl⁻ in NaCl.' },
    { id: 'f2', term: 'Covalent bond', definition: 'Atoms sharing a pair of electrons.', example: 'H₂O: H shares electrons with O.' },
    { id: 'f3', term: 'Ion', definition: 'Atom that has lost or gained electrons, giving it a charge.', example: 'Na⁺ (lost 1e⁻), Cl⁻ (gained 1e⁻).' },
    { id: 'f4', term: 'Metallic bonding', definition: 'Lattice of positive metal ions in a sea of delocalised electrons.', example: undefined },
    { id: 'f5', term: 'Delocalised electrons', definition: 'Electrons not attached to a single atom — free to move throughout a metal.', example: 'Why metals conduct electricity.' },
  ],
  questions: [
    { id: 'q1', stem: 'Electron transfer from metal to non-metal creates:', choices: ['Covalent bond', 'Metallic bond', 'Ionic bond', 'Hydrogen bond'], correctIndex: 2, explanation: 'Ionic bonding involves electron transfer; the ions then attract.' },
    { id: 'q2', stem: 'Bond type in H₂O?', choices: ['Ionic', 'Metallic', 'Covalent', 'Nuclear'], correctIndex: 2, explanation: 'Made of two non-metals (H and O), so they share electrons in covalent bonds.' },
    { id: 'q3', stem: 'Sodium (1 outer electron) in ionic bonding will:', choices: ['Gain 1 → Na⁻', 'Share 1 → covalent', 'Lose 1 → Na⁺', 'Lose 7 → Na⁷⁺'], correctIndex: 2, explanation: 'Metals lose electrons; Na loses its 1 outer electron → Na⁺.' },
    { id: 'q4', stem: 'Why can metals conduct electricity?', choices: ['Ionic bonds carry charge', 'Free-moving delocalised electrons', 'Protons can move', 'Covalent bonds share electrons'], correctIndex: 1, explanation: 'Delocalised electrons flow through the metal lattice as current.' },
    { id: 'q5', stem: 'Ionic compounds:', choices: ['Low melting points', 'Formed between non-metals', 'Giant lattice, high melting points', 'Never conduct electricity'], correctIndex: 2, explanation: 'Strong electrostatic forces in giant lattice → high melting points.' },
  ],
};

const chemAcidsBases: Topic = {
  id: 'chem-acids-1', subjectId: 'chemistry', title: 'Acids, Bases & pH',
  description: 'Properties of acids and alkalis, the pH scale, and neutralisation.', ibLevel: 'MYP',
  notes: [
    { id: 'n1', heading: 'The pH Scale', body: 'pH 0–14. pH 7 = neutral (pure water). Below 7 = acidic (lower = stronger). Above 7 = alkaline (higher = stronger). The scale is logarithmic — each step is 10× more concentrated. Measured with universal indicator or pH meter.' },
    { id: 'n2', heading: 'Acids and Alkalis', body: 'Acids release H⁺ in water. Examples: HCl, H₂SO₄, citric acid (lemons). Turn litmus red. Alkalis release OH⁻ in water. Examples: NaOH, ammonia. Turn litmus blue. Acid + metal → salt + hydrogen. Acid + metal oxide → salt + water.' },
    { id: 'n3', heading: 'Neutralisation', body: 'Acid + Base → Salt + Water. Example: HCl + NaOH → NaCl + H₂O. The salt depends on the acid: HCl → chloride salts, H₂SO₄ → sulfate salts, HNO₃ → nitrate salts. Uses: antacids (stomach), lime (acidic soil), wastewater treatment.' },
  ],
  flashcards: [
    { id: 'f1', term: 'pH scale', definition: '0–14 scale: pH7=neutral, <7=acidic, >7=alkaline.', example: undefined },
    { id: 'f2', term: 'Acid', definition: 'Releases H⁺ ions in water; pH below 7.', example: 'HCl, vinegar (ethanoic acid).' },
    { id: 'f3', term: 'Alkali', definition: 'Base dissolved in water releasing OH⁻ ions; pH above 7.', example: 'NaOH, bleach.' },
    { id: 'f4', term: 'Neutralisation', definition: 'Acid + base → salt + water; moves towards pH 7.', example: 'HCl + NaOH → NaCl + H₂O.' },
    { id: 'f5', term: 'Indicator', definition: 'Substance that changes colour in acid vs alkali.', example: 'Litmus: red in acid, blue in alkali.' },
  ],
  questions: [
    { id: 'q1', stem: 'pH 2 means:', choices: ['Neutral', 'Strong alkali', 'Strong acid', 'Weak acid'], correctIndex: 2, explanation: 'pH 2 is far below 7 — strongly acidic.' },
    { id: 'q2', stem: 'Litmus in alkali turns:', choices: ['Red', 'Yellow', 'Green', 'Blue'], correctIndex: 3, explanation: 'Litmus turns blue in bases/alkalis, red in acids.' },
    { id: 'q3', stem: 'HCl + NaOH → ?', choices: ['Na + Cl + water', 'NaCl + water', 'NaCl + hydrogen', 'NaOH + HCl'], correctIndex: 1, explanation: 'Neutralisation: acid + alkali → salt + water = NaCl + H₂O.' },
    { id: 'q4', stem: 'Soil pH 5. What should a farmer add?', choices: ['More acid', 'Lime (alkali)', 'Pure water', 'Salt'], correctIndex: 1, explanation: 'Acidic soil needs an alkali like lime to raise pH towards neutral.' },
    { id: 'q5', stem: 'Acid + metal carbonate produces:', choices: ['Hydrogen only', 'O₂ and H₂', 'CO₂ and water', 'CO₂ only'], correctIndex: 2, explanation: 'Salt + water + carbon dioxide. CO₂ turns limewater milky.' },
  ],
};

const chemPeriodicTable: Topic = {
  id: 'chem-periodic-1', subjectId: 'chemistry', title: 'The Periodic Table',
  description: 'How elements are organised by atomic number, periods, and groups.', ibLevel: 'MYP',
  notes: [
    { id: 'per-n1', heading: 'Organisation of the Periodic Table', body: 'The periodic table arranges all known elements in order of increasing atomic number. Elements are arranged in rows called periods and columns called groups. There are 7 periods and 18 groups. Elements in the same group have the same number of electrons in their outer shell, which gives them similar chemical properties. The table is divided into metals (left and centre), non-metals (top right), and metalloids (between).' },
    { id: 'per-n2', heading: 'Groups 1 and 7', body: 'Group 1 (alkali metals: Li, Na, K) have 1 outer electron and react vigorously with water and oxygen. Reactivity increases down Group 1 because the outer electron is further from the nucleus and easier to lose. Group 7 (halogens: F, Cl, Br, I) have 7 outer electrons and need just one more to fill their shell. Reactivity decreases down Group 7 because extra shells make it harder to attract electrons.' },
    { id: 'per-n3', heading: 'Metals vs Non-metals', body: 'Most elements are metals: shiny, good conductors, malleable, ductile, high melting points. Non-metals are typically dull, poor conductors (except graphite), brittle when solid. The transition metals (Groups 3–12) form coloured compounds and act as catalysts.' },
  ],
  flashcards: [
    { id: 'per-f1', term: 'Period', definition: 'A horizontal row in the periodic table. Elements in the same period have the same number of electron shells.', example: 'Sodium (Na) and chlorine (Cl) are both in Period 3.' },
    { id: 'per-f2', term: 'Group', definition: 'A vertical column. Elements in the same group have the same number of outer electrons and similar properties.', example: 'Group 1 contains Li, Na, K (alkali metals).' },
    { id: 'per-f3', term: 'Alkali metals', definition: 'Group 1 elements (Li, Na, K, Rb, Cs, Fr) — reactive metals with one outer electron.', example: 'Sodium reacts violently with water.' },
    { id: 'per-f4', term: 'Halogens', definition: 'Group 7 non-metal elements (F, Cl, Br, I, At) that react to gain one electron.', example: 'Chlorine (Cl₂) is a green gas used to disinfect water.' },
    { id: 'per-f5', term: 'Noble gases', definition: 'Group 0 (Group 18) elements with full outer shells, making them very unreactive (inert).', example: 'Helium, neon, argon — used in balloons and lights.' },
  ],
  questions: [
    { id: 'per-q1', stem: 'Elements in the same GROUP have similar chemical properties because they have:', choices: ['The same mass number', 'The same number of protons', 'The same number of electrons in their outer shell', 'The same number of neutrons'], correctIndex: 2, explanation: 'Same outer electrons = similar reactivity.' },
    { id: 'per-q2', stem: 'Down Group 1, how does the reactivity of alkali metals change?', choices: ['Decreases', 'Stays the same', 'First increases then decreases', 'Increases'], correctIndex: 3, explanation: 'Reactivity increases down Group 1 — the outer electron is further from the nucleus and easier to lose.' },
    { id: 'per-q3', stem: 'Why are noble gases (Group 0) so unreactive?', choices: ['They have no protons', 'Their outer electron shell is completely full', 'They are liquids at room temperature', 'They have very large atomic radii'], correctIndex: 1, explanation: 'Full outer shell = no need to gain or lose electrons.' },
    { id: 'per-q4', stem: 'How many electron shells does an element in Period 3 have?', choices: ['1', '2', '3', '4'], correctIndex: 2, explanation: 'The period number = number of electron shells.' },
    { id: 'per-q5', stem: 'Which is a typical property of metals?', choices: ['Poor conductor of electricity', 'Brittle when solid', 'Low melting point', 'Good conductor of heat and electricity'], correctIndex: 3, explanation: 'Metals are good conductors due to free-moving electrons.' },
  ],
};

const chemPhysicalChemicalChanges: Topic = {
  id: 'chem-changes-1', subjectId: 'chemistry', title: 'Physical vs Chemical Changes',
  description: 'How to distinguish between changes that make new substances and those that do not.', ibLevel: 'MYP',
  notes: [
    { id: 'chg-n1', heading: 'Physical Changes', body: 'A physical change alters the form or appearance of a substance without changing what it is made of — no new substances are produced. Usually reversible. Examples: melting ice (still H₂O), dissolving sugar in water, cutting paper. Changes of state (solid ↔ liquid ↔ gas) are always physical changes.' },
    { id: 'chg-n2', heading: 'Chemical Changes', body: 'A chemical change produces one or more new substances with different chemical properties. Usually difficult or impossible to reverse. Signs: colour change, gas produced (bubbling), temperature change, light produced, new smell. Examples: burning wood, rusting iron, cooking an egg, photosynthesis, neutralisation.' },
    { id: 'chg-n3', heading: 'Exothermic and Endothermic Reactions', body: 'Exothermic reactions release heat to the surroundings — the temperature rises. Examples: burning fuels, respiration, neutralisation. Endothermic reactions absorb heat — temperature drops. Examples: thermal decomposition, dissolving ammonium nitrate. In energy profile diagrams, exothermic reactions have products at lower energy than reactants; endothermic have products at higher energy.' },
  ],
  flashcards: [
    { id: 'chg-f1', term: 'Physical change', definition: 'A change that alters the form of a substance but does not produce any new substances. Usually reversible.', example: 'Melting, boiling, dissolving, cutting.' },
    { id: 'chg-f2', term: 'Chemical change', definition: 'A change that produces one or more new substances with different properties. Usually irreversible.', example: 'Burning, rusting, cooking, acid reactions.' },
    { id: 'chg-f3', term: 'Exothermic reaction', definition: 'A chemical reaction that releases energy (as heat) to the surroundings, causing the temperature to rise.', example: 'Burning methane, hand warmers, respiration.' },
    { id: 'chg-f4', term: 'Endothermic reaction', definition: 'A chemical reaction that absorbs energy from the surroundings, causing the temperature to fall.', example: 'Dissolving ammonium nitrate (used in cold packs).' },
    { id: 'chg-f5', term: 'Conservation of mass', definition: 'The total mass of reactants equals the total mass of products in a chemical reaction.', example: undefined },
  ],
  questions: [
    { id: 'chg-q1', stem: 'Which of the following is an example of a PHYSICAL change?', choices: ['Iron rusting in damp air', 'Wood burning in a fireplace', 'Ice melting in a glass', 'Eggs cooking in a pan'], correctIndex: 2, explanation: 'Melting ice is a physical change — still H₂O, just a different state.' },
    { id: 'chg-q2', stem: 'Which observation is the BEST evidence that a chemical change has occurred?', choices: ['The shape of the material changes', 'The material melts', 'A new gas is produced and a colour change occurs', 'The material dissolves in water'], correctIndex: 2, explanation: 'Producing a new gas and a colour change both suggest new substances have formed.' },
    { id: 'chg-q3', stem: 'In an exothermic reaction, what happens to the temperature of the surroundings?', choices: ['Temperature decreases', 'Temperature stays the same', 'Temperature increases', 'Temperature first increases then decreases'], correctIndex: 2, explanation: 'Exothermic reactions release heat → surroundings get hotter.' },
    { id: 'chg-q4', stem: 'A student mixes two solutions and notices the temperature drops. What type of reaction is this?', choices: ['Exothermic', 'Physical change', 'Neutralisation', 'Endothermic'], correctIndex: 3, explanation: 'If temperature drops, the reaction is absorbing heat — endothermic.' },
    { id: 'chg-q5', stem: 'According to conservation of mass, if 10 g of calcium carbonate reacts and 4.4 g of CO₂ escapes, what is the total mass of remaining products?', choices: ['4.4 g', '5.6 g', '10 g', '14.4 g'], correctIndex: 1, explanation: '10 – 4.4 = 5.6 g. Mass is conserved — it doesn\'t disappear with the gas.' },
  ],
};

export const chemistrySubject: Subject = {
  id: 'chemistry', name: 'Chemistry', icon: 'flask', accentColor: '#F97316',
  topics: [chemAtomic, chemBonding, chemAcidsBases, chemPeriodicTable, chemPhysicalChemicalChanges],
};
