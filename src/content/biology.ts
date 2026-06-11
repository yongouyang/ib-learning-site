import { Topic, Subject } from './types';

const bioCells: Topic = {
  id: 'bio-cell-1', subjectId: 'biology', title: 'Cell Structure',
  description: 'The basic unit of life — comparing plant and animal cells and their organelles.', ibLevel: 'MYP',
  notes: [
    { id: 'n1', heading: 'The Cell Theory', body: 'Three principles: (1) All living things are made of cells. (2) The cell is the basic unit of life. (3) All cells come from pre-existing cells. Eukaryotic cells have a nucleus; prokaryotic cells (bacteria) do not.' },
    { id: 'n2', heading: 'Animal Cell Organelles', body: 'Nucleus: control centre, contains DNA. Cell membrane: controls entry/exit. Cytoplasm: jelly-like fluid for reactions. Mitochondria: produce energy (ATP) — "powerhouse". Ribosomes: make proteins.' },
    { id: 'n3', heading: 'Plant Cell Extras', body: 'Plant cells have three extra structures: cell wall (cellulose, for support), large central vacuole (stores water), chloroplasts (contain chlorophyll for photosynthesis). Plant cells are more box-like and regular.' },
  ],
  flashcards: [
    { id: 'f1', term: 'Nucleus', definition: 'Control centre; contains DNA.', example: undefined },
    { id: 'f2', term: 'Mitochondria', definition: 'Produce energy (ATP) through respiration — "powerhouse of the cell".', example: undefined },
    { id: 'f3', term: 'Cell membrane', definition: 'Thin barrier controlling what enters and exits the cell.', example: undefined },
    { id: 'f4', term: 'Chloroplast', definition: 'Found only in plant cells; contains chlorophyll; site of photosynthesis.', example: undefined },
    { id: 'f5', term: 'Cell wall', definition: 'Rigid cellulose layer around plant cells for support.', example: undefined },
  ],
  questions: [
    { id: 'q1', stem: 'Which organelle produces energy?', choices: ['Nucleus', 'Chloroplast', 'Mitochondria', 'Ribosome'], correctIndex: 2, explanation: 'Mitochondria carry out cellular respiration to produce ATP.' },
    { id: 'q2', stem: 'Which structure is in plant cells but NOT animal cells?', choices: ['Cell membrane', 'Nucleus', 'Mitochondria', 'Cell wall'], correctIndex: 3, explanation: 'Plant cells have a cellulose cell wall for extra support.' },
    { id: 'q3', stem: 'Where do new cells come from according to cell theory?', choices: ['Nutrients', 'Pre-existing cells', 'Spontaneous generation', 'DNA alone'], correctIndex: 1, explanation: 'All cells arise from pre-existing cells through division.' },
    { id: 'q4', stem: 'The cell membrane\'s function is to:', choices: ['Make proteins', 'Produce energy', 'Control what enters/exits', 'Store DNA'], correctIndex: 2, explanation: 'It is selectively permeable, controlling substance movement.' },
    { id: 'q5', stem: 'Key difference between prokaryotic and eukaryotic cells?', choices: ['Prokaryotes are larger', 'Eukaryotes have no DNA', 'Prokaryotes lack a membrane-bound nucleus', 'Eukaryotes have no cell membrane'], correctIndex: 2, explanation: 'Prokaryotes have no membrane-bound nucleus — DNA floats freely in cytoplasm.' },
  ],
};

const bioPhotosynthesis: Topic = {
  id: 'bio-photosynthesis-1', subjectId: 'biology', title: 'Photosynthesis',
  description: 'How plants convert light energy into chemical energy stored as glucose.', ibLevel: 'MYP',
  notes: [
    { id: 'n1', heading: 'The Photosynthesis Equation', body: 'Photosynthesis converts light energy to chemical energy (glucose). Word equation: Carbon Dioxide + Water → Glucose + Oxygen (using light energy). Chemical: 6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂. Takes place in chloroplasts using chlorophyll.' },
    { id: 'n2', heading: 'Limiting Factors', body: 'Three main factors: light intensity (more light = faster), CO₂ concentration (more CO₂ = faster), and temperature (faster when warmer, but stops above ~40°C as enzymes denature).' },
    { id: 'n3', heading: 'Uses of Glucose', body: 'Plants use glucose for: respiration (energy), making cellulose (cell walls), making starch (long-term storage — insoluble so doesn\'t affect water balance), and making proteins (combined with nitrates from soil).' },
  ],
  flashcards: [
    { id: 'f1', term: 'Photosynthesis', definition: 'Process where green plants use light to convert CO₂ and water into glucose and oxygen.', example: undefined },
    { id: 'f2', term: 'Chlorophyll', definition: 'Green pigment in chloroplasts that absorbs light energy.', example: undefined },
    { id: 'f3', term: 'Limiting factor', definition: 'A factor that restricts a process when in short supply.', example: 'Low light limits photosynthesis at night.' },
    { id: 'f4', term: 'Starch', definition: 'Insoluble form for storing excess glucose in plants.', example: 'Potatoes store energy as starch.' },
    { id: 'f5', term: 'Stomata', definition: 'Tiny pores on leaves through which CO₂ enters and O₂ exits.', example: undefined },
  ],
  questions: [
    { id: 'q1', stem: 'Reactants (raw materials) for photosynthesis?', choices: ['Glucose and oxygen', 'Carbon dioxide and water', 'Glucose and CO₂', 'Water and oxygen'], correctIndex: 1, explanation: 'CO₂ (from air) and water (from soil) are the raw materials.' },
    { id: 'q2', stem: 'Where does photosynthesis occur?', choices: ['Mitochondria', 'Nucleus', 'Ribosome', 'Chloroplast'], correctIndex: 3, explanation: 'Chloroplasts contain chlorophyll for photosynthesis.' },
    { id: 'q3', stem: 'A plant kept in darkness for 24 hours will:', choices: ['Speed up photosynthesis', 'Stop photosynthesis completely', 'Slow down slightly', 'Photosynthesise normally'], correctIndex: 1, explanation: 'Without light, photosynthesis cannot occur at all.' },
    { id: 'q4', stem: 'Why store glucose as starch?', choices: ['Starch gives more energy', 'Glucose is toxic', 'Starch is insoluble — doesn\'t affect water balance', 'Starch is easier to transport'], correctIndex: 2, explanation: 'Starch is insoluble so it doesn\'t change the cell\'s osmotic concentration.' },
    { id: 'q5', stem: 'Which gas is released as a by-product of photosynthesis?', choices: ['CO₂', 'Nitrogen', 'Oxygen', 'Hydrogen'], correctIndex: 2, explanation: 'Oxygen is released when water molecules split during photosynthesis.' },
  ],
};

const bioBody: Topic = {
  id: 'bio-body-1', subjectId: 'biology', title: 'Human Body Systems',
  description: 'How the digestive, circulatory, and respiratory systems work together to keep us alive.', ibLevel: 'MYP',
  notes: [
    { id: 'n1', heading: 'Digestive System', body: 'Mouth (chewing + saliva) → oesophagus → stomach (acid + enzymes) → small intestine (absorption via villi) → large intestine (water absorption) → rectum. Enzymes: amylase (starch), protease (protein), lipase (fat).' },
    { id: 'n2', heading: 'Circulatory System', body: 'Heart is a double pump: right side → lungs (pulmonary), left side → body (systemic). Arteries carry blood away (high pressure). Veins carry blood back (low pressure, have valves). Capillaries: gas/nutrient exchange. Red blood cells carry oxygen via haemoglobin.' },
    { id: 'n3', heading: 'Respiratory System', body: 'Air: nose/mouth → trachea → bronchi → bronchioles → alveoli. Alveoli: tiny air sacs with large surface area, thin walls, moist surface, rich blood supply — ideal for gas exchange. O₂ diffuses into blood; CO₂ diffuses out.' },
  ],
  flashcards: [
    { id: 'f1', term: 'Enzyme', definition: 'Biological catalyst that speeds up reactions without being used up.', example: 'Amylase breaks down starch in the mouth.' },
    { id: 'f2', term: 'Villi', definition: 'Finger-like projections in small intestine increasing surface area for absorption.', example: undefined },
    { id: 'f3', term: 'Alveoli', definition: 'Tiny air sacs in lungs where gas exchange occurs.', example: undefined },
    { id: 'f4', term: 'Artery', definition: 'Blood vessel carrying blood away from the heart under high pressure.', example: 'Aorta — largest artery.' },
    { id: 'f5', term: 'Haemoglobin', definition: 'Red pigment in RBCs that binds oxygen and carries it round the body.', example: undefined },
  ],
  questions: [
    { id: 'q1', stem: 'Where does absorption of digested food mainly occur?', choices: ['Stomach', 'Large intestine', 'Small intestine', 'Oesophagus'], correctIndex: 2, explanation: 'Small intestine has millions of villi for maximum absorption.' },
    { id: 'q2', stem: 'Which enzyme digests starch in the mouth?', choices: ['Protease', 'Lipase', 'Amylase', 'Insulin'], correctIndex: 2, explanation: 'Amylase in saliva begins breaking down starch.' },
    { id: 'q3', stem: 'What makes alveoli efficient at gas exchange?', choices: ['Thick walls', 'Small surface area', 'Large surface area, thin walls, good blood supply', 'They produce enzymes'], correctIndex: 2, explanation: 'Millions of alveoli with one-cell-thick walls and surrounded by capillaries.' },
    { id: 'q4', stem: 'Where does the right side of the heart pump blood?', choices: ['To the body', 'Back to the left side', 'To the lungs', 'To the brain only'], correctIndex: 2, explanation: 'Right side pumps deoxygenated blood to the lungs to pick up oxygen.' },
    { id: 'q5', stem: 'Which vessel carries blood back to the heart under low pressure?', choices: ['Artery', 'Capillary', 'Vein', 'Aorta'], correctIndex: 2, explanation: 'Veins return blood to the heart; they have valves to prevent backflow.' },
  ],
};

const bioGenetics: Topic = {
  id: 'bio-genetics-1', subjectId: 'biology', title: 'Genetics & Inheritance',
  description: 'How traits are passed from parents to offspring through DNA and genes.', ibLevel: 'MYP',
  notes: [
    { id: 'gen-n1', heading: 'DNA, Genes, and Chromosomes', body: 'DNA (deoxyribonucleic acid) is a long molecule that carries genetic information in a code made of four bases: A, T, C, G. A gene is a short section of DNA that codes for a specific protein — and proteins determine our characteristics. Genes are found on chromosomes, which are coiled-up DNA found in the nucleus. Human cells contain 46 chromosomes (23 pairs). One chromosome from each pair came from each parent.' },
    { id: 'gen-n2', heading: 'Dominant and Recessive Alleles', body: 'For each gene we have two alleles — one from each parent. A dominant allele (capital letter, e.g. B) will show its effect even if only one copy is present. A recessive allele (lowercase, e.g. b) will only show if two copies are present (bb). An organism with two identical alleles (BB or bb) is homozygous. Two different alleles (Bb) is heterozygous. The genetic make-up is the genotype; what you see is the phenotype.' },
    { id: 'gen-n3', heading: 'Punnett Squares', body: 'A Punnett square is a grid used to predict the possible genotypes and phenotypes of offspring from a cross. Write one parent\'s alleles across the top, the other\'s down the side. Each box represents a 25% probability. For a Bb × Bb cross: BB (25%), Bb (50%), bb (25%).' },
  ],
  flashcards: [
    { id: 'gen-f1', term: 'Gene', definition: 'A section of DNA that codes for a specific protein, determining a particular characteristic.', example: 'The gene for eye colour instructs cells to produce certain pigments.' },
    { id: 'gen-f2', term: 'Allele', definition: 'A version of a gene. Two alleles for most genes — one on each chromosome of a pair.', example: 'B (brown eyes) and b (blue eyes) are alleles of the eye colour gene.' },
    { id: 'gen-f3', term: 'Dominant allele', definition: 'An allele that is expressed even when only one copy is present.', example: 'If B = brown eyes is dominant, then BB and Bb both give brown eyes.' },
    { id: 'gen-f4', term: 'Recessive allele', definition: 'An allele that is only expressed when two copies are present (homozygous recessive).', example: 'Blue eyes only appear with genotype bb.' },
    { id: 'gen-f5', term: 'Punnett square', definition: 'A grid diagram used to predict the genotype ratios of offspring from a genetic cross.', example: undefined },
  ],
  questions: [
    { id: 'gen-q1', stem: 'A dominant allele for tall plants (T) is crossed with a recessive allele for short plants (t). What is the phenotype of a plant with genotype Tt?', choices: ['Short', 'Tall', 'Medium height', 'Cannot be determined'], correctIndex: 1, explanation: 'Tt is heterozygous. Because T (tall) is dominant, even one copy causes the plant to be tall.' },
    { id: 'gen-q2', stem: 'Where is DNA found in a eukaryotic cell?', choices: ['Mitochondria only', 'Cytoplasm', 'Nucleus', 'Cell membrane'], correctIndex: 2, explanation: 'In eukaryotic cells, most DNA is located in the nucleus, packaged into chromosomes.' },
    { id: 'gen-q3', stem: 'Two heterozygous brown-eyed parents (Bb × Bb). What fraction of children expected to have blue eyes (bb)?', choices: ['1/4', '1/2', '3/4', '0'], correctIndex: 0, explanation: 'Punnett square: BB, Bb, Bb, bb. One of four = 1/4 (25%).' },
    { id: 'gen-q4', stem: 'What is the term for an organism that has two identical alleles for a gene (e.g., BB or bb)?', choices: ['Heterozygous', 'Homozygous', 'Dominant', 'Recessive'], correctIndex: 1, explanation: 'Homozygous means both alleles for a gene are the same.' },
    { id: 'gen-q5', stem: 'How many chromosomes does a typical human body cell contain?', choices: ['23', '46', '92', '12'], correctIndex: 1, explanation: 'Human body cells contain 46 chromosomes in 23 pairs.' },
  ],
};

const bioEcology: Topic = {
  id: 'bio-ecology-1', subjectId: 'biology', title: 'Ecology & Ecosystems',
  description: 'How living organisms interact with each other and their environment.', ibLevel: 'MYP',
  notes: [
    { id: 'eco-n1', heading: 'Ecosystems and Food Chains', body: 'An ecosystem is all the living organisms (biotic factors) in an area together with the non-living environment (abiotic factors like temperature, light, and water). A food chain shows how energy flows from one organism to the next. It always starts with a producer (a green plant that photosynthesises). Herbivores (primary consumers) eat plants. Carnivores (secondary, tertiary consumers) eat animals. Each step is called a trophic level. Energy is lost at each level (mostly as heat), so chains rarely have more than 4–5 links.' },
    { id: 'eco-n2', heading: 'Food Webs and Interdependence', body: 'A food web shows multiple food chains linked together. If one species is removed, it affects many others — this is called interdependence. For example, if rabbits in a meadow were removed, foxes would have less food and grass would grow more. Biodiversity (the variety of species) makes ecosystems more stable and resilient to change.' },
    { id: 'eco-n3', heading: 'The Carbon and Nitrogen Cycles', body: 'Carbon cycles via photosynthesis (plants absorb CO₂), respiration (organisms release CO₂), feeding (carbon moves through food chains), decomposition (decomposers release CO₂), and combustion. Nitrogen cycles: nitrogen-fixing bacteria convert N₂ into nitrates; plants absorb nitrates; consumers eat plants; decomposers break down dead matter; nitrifying bacteria convert ammonium to nitrates; denitrifying bacteria convert nitrates back to N₂.' },
  ],
  flashcards: [
    { id: 'eco-f1', term: 'Producer', definition: 'An organism that makes its own food through photosynthesis, forming the base of food chains.', example: 'Grass, trees, algae.' },
    { id: 'eco-f2', term: 'Consumer', definition: 'An organism that obtains energy by eating other organisms.', example: 'A rabbit (primary consumer) eats grass; a fox (secondary consumer) eats rabbits.' },
    { id: 'eco-f3', term: 'Food web', definition: 'A diagram showing the feeding relationships between all organisms in an ecosystem — multiple food chains linked together.', example: undefined },
    { id: 'eco-f4', term: 'Decomposer', definition: 'An organism (like bacteria or fungi) that breaks down dead organic matter, recycling nutrients back into the soil.', example: undefined },
    { id: 'eco-f5', term: 'Biodiversity', definition: 'The variety of different species living in an ecosystem. High biodiversity makes ecosystems more stable.', example: undefined },
  ],
  questions: [
    { id: 'eco-q1', stem: 'In a food chain, which organism is always at the start (the producer)?', choices: ['A carnivore', 'A decomposer', 'A herbivore', 'A green plant'], correctIndex: 3, explanation: 'Producers (green plants) make their own food using photosynthesis. They form the energy base for all other organisms.' },
    { id: 'eco-q2', stem: 'Why is energy lost at each step in a food chain?', choices: ['Energy is destroyed when organisms eat each other', 'Most energy is released as heat during respiration and not passed on', 'Organisms use energy to produce oxygen', 'Energy turns into matter at each trophic level'], correctIndex: 1, explanation: 'At each trophic level, organisms use much of the energy for their own respiration, releasing it as heat. Only about 10% is transferred to the next level.' },
    { id: 'eco-q3', stem: 'If the population of rabbits in a food web suddenly crashed, what would most likely happen to the fox population?', choices: ['It would increase', 'It would stay the same', 'It would decrease', 'It would move to a different ecosystem'], correctIndex: 2, explanation: 'If rabbits (a food source for foxes) decrease, foxes will have less food and their population will decrease.' },
    { id: 'eco-q4', stem: 'What role do decomposers play in nutrient cycles?', choices: ['They produce oxygen for other organisms', 'They convert sunlight into chemical energy', 'They break down dead organisms and return nutrients to the soil', 'They fix nitrogen directly from the atmosphere'], correctIndex: 2, explanation: 'Decomposers (bacteria and fungi) break down dead organic matter, releasing nutrients back into the soil.' },
    { id: 'eco-q5', stem: 'What does "biodiversity" mean?', choices: ['The total mass of all living organisms in an area', 'The number of individuals in a single species', 'The variety of different species in an ecosystem', 'The amount of food energy available in an ecosystem'], correctIndex: 2, explanation: 'Biodiversity refers to the variety of species present. High biodiversity indicates a healthy ecosystem.' },
  ],
};

export const biologySubject: Subject = {
  id: 'biology', name: 'Biology', icon: 'leaf', accentColor: '#22C55E',
  topics: [bioCells, bioPhotosynthesis, bioBody, bioGenetics, bioEcology],
};
