import { Topic, Subject } from './types';

const physForces: Topic = {
  id: 'phys-forces-1', subjectId: 'physics', title: 'Forces & Motion',
  description: 'Newton\'s laws, speed, velocity, acceleration, and balanced/unbalanced forces.', ibLevel: 'MYP',
  notes: [
    { id: 'n1', heading: 'Speed, Velocity, Acceleration', body: 'Speed = distance ÷ time (m/s). Velocity = speed with direction (vector). Acceleration = change in velocity ÷ time (m/s²). Distance-time graphs: slope = speed. Velocity-time graphs: slope = acceleration, area under = distance.' },
    { id: 'n2', heading: 'Newton\'s Three Laws', body: '1st: Object stays at rest or constant velocity unless acted on by a net force. 2nd: F = ma (force = mass × acceleration). 3rd: For every action, equal and opposite reaction.' },
    { id: 'n3', heading: 'Balanced and Unbalanced Forces', body: 'Balanced forces → zero net force → object stays still or constant velocity. Unbalanced forces → net force → acceleration. Weight W = mg (g ≈ 10 m/s² on Earth). Friction, air resistance, and normal force are common forces.' },
  ],
  flashcards: [
    { id: 'f1', term: 'Speed', definition: 'Distance per unit time: speed = distance ÷ time.', example: '100 m in 5 s = 20 m/s.' },
    { id: 'f2', term: 'Acceleration', definition: 'Rate of change of velocity: a = Δv ÷ t (m/s²).', example: '0→20 m/s in 4s: a=5 m/s².' },
    { id: 'f3', term: 'Newton\'s 2nd Law', definition: 'F = ma. Force = mass × acceleration.', example: 'F = 10kg × 3m/s² = 30N.' },
    { id: 'f4', term: 'Resultant force', definition: 'The single force with the same effect as all individual forces combined.', example: '10N + 10N same direction = 20N resultant.' },
    { id: 'f5', term: 'Weight', definition: 'Gravitational force: W = mg (Newtons).', example: '5kg object: W = 5×10 = 50N.' },
  ],
  questions: [
    { id: 'q1', stem: 'Car travels 150 m in 10 s. Average speed?', choices: ['10 m/s', '1500 m/s', '15 m/s', '150 m/s'], correctIndex: 2, explanation: 'Speed = 150÷10 = 15 m/s.' },
    { id: 'q2', stem: '4kg object, net force 20N. Acceleration?', choices: ['80 m/s²', '0.2 m/s²', '5 m/s²', '16 m/s²'], correctIndex: 2, explanation: 'a = F÷m = 20÷4 = 5 m/s².' },
    { id: 'q3', stem: 'Skydiver falling at constant speed. Forces are:', choices: ['Gravity > air resistance', 'No forces', 'Air resistance > gravity', 'Balanced'], correctIndex: 3, explanation: 'Constant speed → zero acceleration → forces balanced (Newton\'s 1st law).' },
    { id: 'q4', stem: 'Rocket expels gas downward. Rocket goes:', choices: ['Nowhere', 'Upward (equal and opposite)', 'Slower', 'Downward'], correctIndex: 1, explanation: 'Newton\'s 3rd law: gas pushes down, rocket pushes up.' },
    { id: 'q5', stem: 'Weight of 12kg object? (g=10 m/s²)', choices: ['1.2N', '12N', '120N', '22N'], correctIndex: 2, explanation: 'W = mg = 12×10 = 120N.' },
  ],
};

const physEnergy: Topic = {
  id: 'phys-energy-1', subjectId: 'physics', title: 'Energy & Transformations',
  description: 'Types of energy, conservation of energy, and energy efficiency.', ibLevel: 'MYP',
  notes: [
    { id: 'n1', heading: 'Types of Energy', body: 'Kinetic (motion): KE=½mv². Gravitational potential (height): GPE=mgh. Elastic potential (stretched). Chemical (fuels, food). Thermal (heat). Nuclear, light, sound. Energy measured in joules (J).' },
    { id: 'n2', heading: 'Conservation of Energy', body: 'Energy cannot be created or destroyed — only transferred or transformed. Total energy in a closed system stays constant. Example: falling ball converts GPE → KE. Light bulb: electrical → light + heat. Sankey diagrams show useful vs wasted energy.' },
    { id: 'n3', heading: 'Efficiency', body: 'Efficiency = (useful output ÷ total input) × 100%. Nothing is 100% efficient — some energy always wasted as heat. Example: motor takes 500J, outputs 400J → efficiency = 80%. To improve: insulation, better design, reduced friction.' },
  ],
  flashcards: [
    { id: 'f1', term: 'Kinetic energy', definition: 'Energy of motion: KE = ½mv².', example: '2kg ball at 3m/s: KE = ½×2×9 = 9J.' },
    { id: 'f2', term: 'GPE', definition: 'Energy due to height: GPE = mgh.', example: '5kg on 2m shelf: GPE=5×10×2=100J.' },
    { id: 'f3', term: 'Conservation of energy', definition: 'Energy cannot be created or destroyed, only transferred/transformed.', example: undefined },
    { id: 'f4', term: 'Efficiency', definition: '(useful output ÷ total input) × 100%.', example: '200J in, 150J out → 75% efficient.' },
    { id: 'f5', term: 'Wasted energy', definition: 'Energy transferred to non-useful forms (usually heat or sound).', example: undefined },
  ],
  questions: [
    { id: 'q1', stem: '3kg ball at 4 m/s. Kinetic energy?', choices: ['12J', '24J', '48J', '6J'], correctIndex: 1, explanation: 'KE = ½mv² = ½×3×16 = 24J.' },
    { id: 'q2', stem: 'Lamp: 100J in, 20J light. Efficiency?', choices: ['80%', '20%', '5%', '120%'], correctIndex: 1, explanation: '(20÷100)×100 = 20%.' },
    { id: 'q3', stem: 'Ball dropping: energy transformation?', choices: ['KE → GPE', 'Chemical → KE', 'GPE → KE', 'Thermal → KE'], correctIndex: 2, explanation: 'Losing height: GPE is converted to kinetic energy.' },
    { id: 'q4', stem: 'Correct energy statement:', choices: ['Energy destroyed when light off', 'Energy created from force', 'Energy cannot be created or destroyed, only transferred/transformed', 'Total energy always decreases'], correctIndex: 2, explanation: 'This is the law of conservation of energy — a fundamental physics principle.' },
    { id: 'q5', stem: '10kg box lifted 3m. GPE? (g=10 m/s²)', choices: ['30J', '130J', '300J', '1000J'], correctIndex: 2, explanation: 'GPE = mgh = 10×10×3 = 300J.' },
  ],
};

const physElectricity: Topic = {
  id: 'phys-electricity-1', subjectId: 'physics', title: 'Electricity Basics',
  description: 'Circuits, current, voltage, resistance, and Ohm\'s Law.', ibLevel: 'MYP',
  notes: [
    { id: 'n1', heading: 'Current, Voltage, Resistance', body: 'Current (I): flow of charge, measured in amperes (A). Voltage (V): energy per unit charge (potential difference), measured in volts (V). Resistance (R): opposition to current, measured in ohms (Ω). Ohm\'s Law: V = IR.' },
    { id: 'n2', heading: 'Series and Parallel Circuits', body: 'Series: single loop, same current everywhere, voltages add up, if one component fails the circuit breaks. Parallel: separate branches, each gets full voltage, current splits, if one branch fails others keep working. Homes use parallel wiring.' },
    { id: 'n3', heading: 'Power and Energy', body: 'Electrical power P = VI (watts, W). Energy transferred E = Pt (joules, J). A 100W bulb transfers 100J every second. Kilowatt-hour (kWh): 1kWh = 1000W for 1 hour = 3,600,000J. Cost = power(kW)×time(h)×unit price.' },
  ],
  flashcards: [
    { id: 'f1', term: 'Current', definition: 'Flow of electric charge, measured in amperes (A).', example: undefined },
    { id: 'f2', term: 'Voltage', definition: 'Energy per unit charge — the "push" driving current. Measured in volts (V).', example: undefined },
    { id: 'f3', term: 'Resistance', definition: 'Opposition to current flow, measured in ohms (Ω).', example: undefined },
    { id: 'f4', term: 'Ohm\'s Law', definition: 'V = IR. Voltage = current × resistance.', example: 'I=2A, R=5Ω → V=10V.' },
    { id: 'f5', term: 'Series circuit', definition: 'All components in one loop — same current throughout.', example: undefined },
  ],
  questions: [
    { id: 'q1', stem: 'Resistance 10Ω, current 3A. Voltage?', choices: ['0.3V', '7V', '13V', '30V'], correctIndex: 3, explanation: 'V = IR = 3×10 = 30V.' },
    { id: 'q2', stem: 'Two identical lamps in series. Current through each compared to total?', choices: ['Each gets double', 'Each gets same as total', 'Each gets half', 'They share equally, each getting half'], correctIndex: 1, explanation: 'In series, same current flows through every component.' },
    { id: 'q3', stem: 'Why are homes wired in parallel?', choices: ['Uses less energy', 'Each appliance gets full voltage, independent switching', 'Series is more dangerous', 'Parallel has lower resistance'], correctIndex: 1, explanation: 'Parallel: each appliance gets 230V and can be switched on/off independently.' },
    { id: 'q4', stem: 'Kettle: 2000W, used 0.5h. Energy in kWh?', choices: ['0.5 kWh', '1 kWh', '2 kWh', '4000 kWh'], correctIndex: 1, explanation: '2kW × 0.5h = 1 kWh.' },
    { id: 'q5', stem: '12V across 4Ω. Current?', choices: ['48A', '8A', '3A', '0.33A'], correctIndex: 2, explanation: 'I = V÷R = 12÷4 = 3A.' },
  ],
};

export const physicsSubject: Subject = {
  id: 'physics', name: 'Physics', icon: 'atom', accentColor: '#EF4444',
  topics: [physForces, physEnergy, physElectricity],
};
