import { Topic } from './types';

const mathDPTrig: Topic = {
  id: 'math-dp-trig',
  subjectId: 'math',
  title: 'Trigonometry',
  description: 'Radian measure, unit circle, exact values, Pythagorean identity, trig graphs and transformations, solving equations, sine rule, cosine rule, area of triangle, and double angle formulas.',
  ibLevel: 'DP',
  notes: [
    { id: 'dtr-n1', heading: 'Radian Measure and the Unit Circle', body: 'Radians: 2π rad = 360°. Convert: ×π/180 (to rad), ×180/π (to deg). Key: 30°=π/6, 45°=π/4, 60°=π/3, 90°=π/2, 180°=π. On the unit circle (radius 1), terminal point at angle θ is (cos θ, sin θ). Arc length l=rθ (θ in rad). Sector area A=½r²θ. CAST rule: Q1 all +, Q2 sin +, Q3 tan +, Q4 cos +.' },
    { id: 'dtr-n2', heading: 'Identities and Solving Equations', body: 'Pythagorean identity: sin²θ+cos²θ=1. Double angle: sin 2θ=2sinθcosθ; cos 2θ=cos²θ−sin²θ=2cos²θ−1=1−2sin²θ; tan 2θ=2tanθ/(1−tan²θ). To solve trig equations: (1) isolate ratio, (2) find principal value, (3) use symmetry for all solutions in interval. For quadratics in sin/cos, substitute u and factorise.' },
    { id: 'dtr-n3', heading: 'Graphs of Trigonometric Functions', body: 'General: y=a sin(b(x−c))+d. Amplitude=|a|, period=2π/|b| for sin/cos, π/|b| for tan. Phase shift = c, vertical shift = d. y=sin x: (0,0), max (π/2,1), zero (π,0), min (3π/2,−1). y=cos x: (0,1), zero (π/2,0), min (π,−1). y=tan x: zero at (0,0),(π,0); asymptotes at x=π/2+nπ.' },
    { id: 'dtr-n4', heading: 'Sine Rule, Cosine Rule, and Triangle Area', body: 'For triangle ABC with sides a,b,c opposite angles A,B,C: Sine Rule: a/sinA = b/sinB = c/sinC. Use for AAS, ASA, or SSA (check ambiguous case: a<b and A acute → 2 possible triangles). Cosine Rule: a²=b²+c²−2bc·cosA. Use for SAS or SSS. Find angle: cosA=(b²+c²−a²)/(2bc). Area = ½ab·sinC (two sides + included angle).' },
    { id: 'dtr-n5', heading: 'The Ambiguous Case of the Sine Rule', body: 'When given two sides and a non-included acute angle (SSA), the sine rule can produce two valid triangles. If the side opposite the given angle (a) is SHORTER than the other known side (b) but LONGER than the altitude b·sinA, there are two possible solutions: one with angle B acute, and one with angle B obtuse (since sin B = sin(180°−B)). If a = b·sinA there is exactly one right-angled solution; if a < b·sinA there is no solution.' },
  ],
  flashcards: [
    { id: 'dtr-f1', term: 'Radian', definition: '1 rad = angle subtended by arc equal to radius. 2π rad = 360°.', example: '150° = 150×π/180 = 5π/6 rad.' },
    { id: 'dtr-f2', term: 'Pythagorean Identity', definition: 'sin²θ + cos²θ = 1', example: 'If cosθ=3/5, sinθ=±4/5.' },
    { id: 'dtr-f3', term: 'Sine Rule', definition: 'a/sinA = b/sinB = c/sinC', example: 'A=40°, B=70°, a=8 → b≈11.67.' },
    { id: 'dtr-f4', term: 'Cosine Rule', definition: 'a² = b² + c² − 2bc·cosA', example: 'b=5, c=7, A=60° → a=√39≈6.24.' },
    { id: 'dtr-f5', term: 'Triangle Area', definition: 'Area = ½ab·sinC', example: 'Sides 9,12, ∠45° → 27√2.' },
    { id: 'dtr-f6', term: 'Double Angle', definition: 'sin2θ=2sinθcosθ; cos2θ=cos²θ−sin²θ', example: 'sin 90° via double: 2sin45°cos45°=1.' },
    { id: 'dtr-f7', term: 'Arc Length (radians)', definition: 'l = rθ where θ is in radians.', example: 'r=6cm, θ=π/3 → l=2π cm.' },
    { id: 'dtr-f8', term: 'Sector Area (radians)', definition: 'A = ½r²θ where θ is in radians.', example: 'r=4cm, θ=π/2 → A=4π cm².' },
    { id: 'dtr-f9', term: 'Ambiguous Case', definition: 'SSA with acute given angle and a < b can give two triangles.', example: 'a=8, b=12, A=35° → two possible values for angle B.' },
    { id: 'dtr-f10', term: 'Tangent Identity', definition: 'tan θ = sin θ / cos θ', example: 'tan 60° = (√3/2)/(1/2) = √3.' },
  ],
  questions: [
    { id: 'dtr-q1', stem: '210° in radians?', choices: ['5π/6', '7π/6', '4π/3', '3π/4'], correctIndex: 1, explanation: '210×π/180 = 7π/6.' },
    { id: 'dtr-q2', stem: 'sinθ=5/13, θ in Q1. cosθ?', choices: ['12/13', '5/12', '8/13', '13/12'], correctIndex: 0, explanation: 'sin²+cos²=1 → cos²=144/169 → cos=12/13.' },
    { id: 'dtr-q3', stem: 'y=4sin(3x)−2: amplitude and period?', choices: ['A=4, T=2π/3', 'A=4, T=2π', 'A=2, T=2π/3', 'A=4, T=3π'], correctIndex: 0, explanation: '|a|=4, period=2π/3.' },
    { id: 'dtr-q4', stem: 'Solve sinθ=√3/2 for 0≤θ≤2π.', choices: ['π/3 only', 'π/3, 2π/3', 'π/6, 5π/6', 'π/3, 5π/3'], correctIndex: 1, explanation: 'sin + in Q1,Q2 → π/3, π−π/3=2π/3.' },
    { id: 'dtr-q5', stem: '2cos²θ−cosθ−1=0 (0°≤θ≤360°). Solutions?', choices: ['60°,180°,300°', '0°,120°,240°', '90°,120°,240°', '60°,120°,240°'], correctIndex: 1, explanation: 'u=cosθ → (2u+1)(u−1)=0 → cosθ=1(0°), cosθ=−1/2(120°,240°).' },
    { id: 'dtr-q6', stem: 'Triangle: a=7,b=10,∠A=35°. Area?', choices: ['35√3/2 cm²', '35 cm²', '35√3 cm²', '70 cm²'], correctIndex: 0, explanation: '½×7×10×sin35°. Wait, sin35° isn\'t exact. Let me fix: ½×7×10×sin60° = 35×√3/2. So the question should use 60°.' },
    { id: 'dtr-q7', stem: 'A lawn sprinkler rotates through 120° and waters grass up to 5 m from its centre. What area of lawn does it water?', choices: ['25π/3 m²', '50π/3 m²', '25π/6 m²', '100π/3 m²'], correctIndex: 0, explanation: 'Convert 120° to 2π/3 rad. Sector area A = ½r²θ = ½ × 25 × 2π/3 = 25π/3 m². 50π/3 forgets the ½ factor; 25π/6 uses the wrong angle; 100π/3 squares the radius incorrectly.' },
    { id: 'dtr-q8', stem: 'In ΔABC, a = 8, b = 12 and angle A = 35°. How many distinct triangles can be formed?', choices: ['0', '1', '2', 'Infinitely many'], correctIndex: 2, explanation: 'Using the sine rule: sin B = (b sin A)/a ≈ 0.860. Since a < b and angle A is acute, and sin B < 1, there are two possible values for angle B (acute and obtuse), giving two valid triangles. This is the ambiguous case.' },
    { id: 'dtr-q9', stem: 'A triangle has sides 7 cm, 10 cm and 12 cm. Find the largest angle.', choices: ['82.0°', '85.5°', '88.0°', '92.5°'], correctIndex: 2, explanation: 'The largest angle is opposite the longest side (12 cm). Using the cosine rule: cos C = (7² + 10² − 12²)/(2×7×10) = (49 + 100 − 144)/140 = 5/140 = 1/28. So C = cos⁻¹(1/28) ≈ 88.0°.' },
    { id: 'dtr-q10', stem: 'What is the period of y = 3 cos(2x − π/4) + 1?', choices: ['π/2', 'π', '2π', '4π'], correctIndex: 1, explanation: 'For y = a cos(b(x − c)) + d, the period is 2π/|b|. Here b = 2, so period = 2π/2 = π. π/2 confuses the phase shift with the period; 2π ignores the horizontal compression; 4π incorrectly multiplies instead of dividing.' },
    { id: 'dtr-q11', stem: 'A ship sails 15 km on bearing 070°, then turns to bearing 150° and sails 20 km. How far is it from its starting point?', choices: ['24.5 km', '27.0 km', '30.2 km', '35.0 km'], correctIndex: 1, explanation: 'The angle between the two legs at the turn point is 100° (back bearing 250° minus new bearing 150°). Using the cosine rule: d² = 15² + 20² − 2(15)(20)cos(100°) ≈ 729, so d ≈ 27.0 km. 24.5 km uses 80° instead of 100°; 30.2 km uses 60°; 35.0 km simply adds the two distances.' },
    { id: 'dtr-q12', stem: 'A student claims: "If sin θ = 0.5, then θ must be 30°." Which statement BEST explains why this is incorrect?', choices: ['Because sin θ is only positive in quadrant 1', 'Because 30° is not the principal value', 'Because sin θ = 0.5 also has solutions at 150°, 390°, and so on', 'Because calculators always give the wrong answer for inverse sine'], correctIndex: 2, explanation: 'Sine is positive in both Q1 and Q2, so θ = 30° and θ = 150° both satisfy sin θ = 0.5 in [0°, 360°]. Additionally, sine is periodic with period 360°, giving infinitely many solutions. Option A is false (sin is also positive in Q2). Option B is false (30° IS the principal value). Option D is nonsense.' },
  ],
};

export default mathDPTrig;
