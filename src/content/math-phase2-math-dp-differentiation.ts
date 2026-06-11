import { Topic } from './types';

const mathDPDifferentiation: Topic = {
  id: 'math-dp-differentiation',
  subjectId: 'math',
  title: 'Differentiation',
  description: 'First principles, derivative rules (power, product, quotient, chain), standard derivatives, tangents and normals, stationary points, second derivative test, concavity, points of inflection, related rates, and optimisation.',
  ibLevel: 'DP',
  notes: [
    { id: 'dif-n1', heading: 'First Principles and Derivative Rules', body: 'f\'(x) = lim[h→0] [f(x+h)−f(x)]/h. Power rule: d/dx(xⁿ)=nxⁿ⁻¹. Product: d/dx(uv)=u\'v+uv\'. Quotient: d/dx(u/v)=(u\'v−uv\')/v². Chain: d/dx[f(g(x))]=f\'(g(x))·g\'(x). Standard: d/dx(sin x)=cos x; d/dx(cos x)=−sin x; d/dx(eˣ)=eˣ; d/dx(ln x)=1/x.' },
    { id: 'dif-n2', heading: 'Tangents, Normals, and Curve Analysis', body: 'Tangent at x=a: gradient mT=f\'(a). Equation: y−f(a)=f\'(a)(x−a). Normal: mN=−1/f\'(a). f\'(x)>0 → increasing; f\'(x)<0 → decreasing. Stationary points: f\'(x)=0. First derivative test: check sign change of f\'. Second derivative test: f\'\'<0→max; f\'\'>0→min; f\'\'=0→inconclusive. Point of inflection: f\'\'(x)=0 and sign changes.' },
    { id: 'dif-n3', heading: 'Optimisation Problems', body: '(1) Identify quantity Q to optimise. (2) Express in one variable using constraints. (3) Find domain. (4) dQ/dx=0, solve. (5) Verify max/min (second derivative test or endpoints). (6) Answer in context. Example: rectangle with fixed perimeter 100m → area A=x(50−x), max at x=25 (square).' },
    { id: 'dif-n4', heading: 'Related Rates of Change', body: 'Related rates connect how two quantities change with respect to time (or another variable) using the chain rule. If V and r are linked by a formula, then dV/dt = dV/dr × dr/dt. Common contexts: expanding balloon (volume vs radius), sliding ladder (x vs y), filling tank (volume vs height). Step 1: write the linking formula. Step 2: differentiate implicitly with respect to time. Step 3: substitute known rates and values. Always include units in the final answer.' },
  ],
  flashcards: [
    { id: 'dif-f1', term: 'Power Rule', definition: 'd/dx(xⁿ)=nxⁿ⁻¹', example: 'd/dx(x⁵)=5x⁴; d/dx(√x)=1/(2√x).' },
    { id: 'dif-f2', term: 'Product Rule', definition: 'd/dx(uv)=u\'v+uv\'', example: 'd/dx(x³eˣ)=3x²eˣ+x³eˣ.' },
    { id: 'dif-f3', term: 'Chain Rule', definition: 'd/dx[f(g(x))]=f\'(g(x))·g\'(x)', example: 'd/dx(sin(3x²))=6x·cos(3x²).' },
    { id: 'dif-f4', term: 'Stationary Point', definition: 'Where f\'(x)=0. Tangent is horizontal.', example: 'f(x)=x³−3x: f\'(x)=0 at x=±1.' },
    { id: 'dif-f5', term: '2nd Derivative Test', definition: 'f\'(c)=0: f\'\'(c)<0→max; f\'\'(c)>0→min.', example: 'f(x)=−x²: f\'(0)=0, f\'\'(0)=−2→max.' },
    { id: 'dif-f6', term: 'Quotient Rule', definition: 'd/dx(u/v) = (u\'v − uv\') / v²', example: 'd/dx(x²/sin x) = (2x·sin x − x²·cos x) / sin²x.' },
    { id: 'dif-f7', term: 'Standard derivatives of eˣ and ln x', definition: 'd/dx(eˣ) = eˣ; d/dx(ln x) = 1/x (x>0).', example: 'd/dx(e³ˣ) = 3e³ˣ by chain rule; d/dx(ln(5x)) = 1/x.' },
    { id: 'dif-f8', term: 'Related rates', definition: 'Use the chain rule to connect rates of change of linked quantities.', example: 'For a sphere V=(4/3)πr³, dV/dt = 4πr² · dr/dt.' },
    { id: 'dif-f9', term: 'Point of inflection', definition: 'Where concavity changes: f\'\'(x)=0 AND sign of f\'\' changes through the point.', example: 'f(x)=x³: f\'\'(x)=6x=0 at x=0, changes from − to + → inflection at (0,0).' },
  ],
  questions: [
    { id: 'dif-q1', stem: 'd/dx(5x⁴−3x²+7x−2)?', choices: ['20x³−6x+7', '20x³−3x+7', '5x³−6x+7', '20x⁴−6x+7'], correctIndex: 0, explanation: 'Term by term: 20x³−6x+7.' },
    { id: 'dif-q2', stem: 'd/dx[(2x+3)⁵]?', choices: ['5(2x+3)⁴', '10(2x+3)⁴', '5(2x+3)⁵', '2(2x+3)⁴'], correctIndex: 1, explanation: 'Chain: 5(2x+3)⁴×2=10(2x+3)⁴.' },
    { id: 'dif-q3', stem: 'd/dx(x³sin x)?', choices: ['3x² cos x', '3x²sin x + x³cos x', '3x²sin x − x³cos x', 'x³cos x'], correctIndex: 1, explanation: 'Product: 3x²sin x + x³cos x.' },
    { id: 'dif-q4', stem: 'Gradient of tangent to y=x³−3x at x=2?', choices: ['9', '3', '6', '−3'], correctIndex: 0, explanation: 'f\'(x)=3x²−3; f\'(2)=12−3=9.' },
    { id: 'dif-q5', stem: 'Stationary points of f(x)=2x³−9x²+12x?', choices: ['x=1,2', 'x=0,3', 'x=−1,2', 'x=3 only'], correctIndex: 0, explanation: 'f\'(x)=6x²−18x+12=6(x−1)(x−2)=0.' },
    { id: 'dif-q6', stem: 'Rectangle perimeter 60cm. Max area?', choices: ['20×10=200', '15×15=225', '25×5=125', '30×0=0'], correctIndex: 1, explanation: 'A=x(30−x); max at x=15; 15×15=225.' },
    { id: 'dif-q7', stem: 'd/dx[(2x+1)/(x−3)]?', choices: ['(2x+1)/(x−3)²', '−7/(x−3)²', '7/(x−3)²', '(2x−5)/(x−3)²'], correctIndex: 1, explanation: 'Quotient rule: [2(x−3) − (2x+1)(1)] / (x−3)² = (2x−6−2x−1)/(x−3)² = −7/(x−3)².' },
    { id: 'dif-q8', stem: 'Find the equation of the normal to y=x² at the point (2,4).', choices: ['y = −¼x + 9/2', 'y = 4x − 4', 'y = ¼x + 7/2', 'y = −4x + 12'], correctIndex: 0, explanation: 'f\'(x)=2x → gradient of tangent at x=2 is 4. Gradient of normal = −¼ (negative reciprocal). Using y−4 = −¼(x−2) gives y = −¼x + 9/2.' },
    { id: 'dif-q9', stem: 'A spherical balloon is inflated so its radius increases at 2 cm/s. When r = 5 cm, what is the rate of increase of volume? (V = (4/3)πr³)', choices: ['100π cm³/s', '200π cm³/s', '50π cm³/s', '40π cm³/s'], correctIndex: 1, explanation: 'Differentiate V with respect to t: dV/dt = 4πr² · dr/dt. Substitute r=5 and dr/dt=2: dV/dt = 4π(25)(2) = 200π cm³/s.' },
    { id: 'dif-q10', stem: 'f\'(c)=0 and f\'\'(c)=0 at a stationary point. What should you do next?', choices: ['Conclude it is a point of inflection', 'Use the first derivative test', 'Conclude it is neither max nor min', 'Divide f by f\'\''], correctIndex: 1, explanation: 'When the second derivative is zero, the test is inconclusive. You must check the sign of f\'(x) on either side of c (first derivative test) to determine the nature of the stationary point.' },
    { id: 'dif-q11', stem: 'd/dx[ln(4x+3)]?', choices: ['1/(4x+3)', '4/(4x+3)', '4x+3', '1/x'], correctIndex: 1, explanation: 'Chain rule: derivative of ln(u) is u\'/u. Here u=4x+3, so u\'=4. Answer = 4/(4x+3).' },
    { id: 'dif-q12', stem: 'An open-top box with square base has volume 500 cm³. Find the base side length that minimises surface area.', choices: ['5 cm', '10 cm', '15 cm', '25 cm'], correctIndex: 1, explanation: 'Let base side = x and height = h. Volume x²h = 500 → h = 500/x². Surface area A = x² + 4xh = x² + 2000/x. dA/dx = 2x − 2000/x² = 0 → 2x³ = 2000 → x³ = 1000 → x = 10 cm. Second derivative is positive, confirming a minimum.' },
  ],
};

export default mathDPDifferentiation;
