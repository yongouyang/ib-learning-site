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

export const chemistrySubject: Subject = {
  id: 'chemistry', name: 'Chemistry', icon: 'flask', accentColor: '#F97316',
  topics: [chemAtomic, chemBonding, chemAcidsBases],
};
