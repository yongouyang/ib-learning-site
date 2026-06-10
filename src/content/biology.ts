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

export const biologySubject: Subject = {
  id: 'biology', name: 'Biology', icon: 'leaf', accentColor: '#22C55E',
  topics: [bioCells, bioPhotosynthesis, bioBody],
};
