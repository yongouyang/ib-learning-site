import { Topic } from './types';

const mathDPIntegration: Topic = {
  id: 'math-dp-integration',
  subjectId: 'math',
  title: 'Integration',
  description: 'Antiderivatives, indefinite integrals, definite integrals, Fundamental Theorem of Calculus, area under and between curves, substitution, and kinematics.',
  ibLevel: 'DP',
  notes: [
    { id: 'int-n1', heading: 'Antiderivatives and Indefinite Integrals', body: '∫f(x)dx = F(x)+C where F\'=f. C is constant of integration. Power: ∫xⁿdx = xⁿ⁺¹/(n+1)+C (n≠−1). ∫1/x dx = ln|x|+C. ∫eˣdx = eˣ+C. ∫sin x dx = −cos x+C; ∫cos x dx = sin x+C. To find C, use given point F(a)=b.' },
    { id: 'int-n2', heading: 'Definite Integrals and FTC', body: '∫ₐᵇ f(x)dx = F(b)−F(a) where F\'=f. Area under y=f(x) above x-axis = ∫ₐᵇ f(x)dx. If curve goes below axis, split at zeros and take absolute values. Area between curves: ∫ₐᵇ [f(x)−g(x)]dx where f≥g on [a,b]. Intersection points give limits.' },
    { id: 'int-n3', heading: 'Integration by Substitution', body: 'Reverse of chain rule. Choose u=g(x), du=g\'(x)dx, rewrite integral in u, integrate, substitute back. For definite integrals, change limits: when x=a→u=g(a), x=b→u=g(b). Shortcut: ∫f\'(x)/f(x)dx = ln|f(x)|+C.' },
    { id: 'int-n4', heading: 'Kinematics and Volume of Revolution', body: 'Displacement = ∫v dt (signed). Total distance = ∫|v| dt (split at v=0). Given a(t): v=∫a dt+C₁; s=∫v dt+C₂. Volume of revolution (AA HL): V=π∫ₐᵇ [f(x)]²dx (rotate around x-axis).' },
    { id: 'int-n5', heading: 'Reverse Chain Rule and Composite Functions', body: 'Reverse chain rule: ∫g\'(x)·f(g(x))dx = F(g(x)) + C where F\'=f. Special linear cases: ∫(ax+b)ⁿdx = (ax+b)ⁿ⁺¹/(a(n+1)) + C (n≠−1); ∫sin(ax+b)dx = −(1/a)cos(ax+b) + C; ∫cos(ax+b)dx = (1/a)sin(ax+b) + C; ∫sec²(ax+b)dx = (1/a)tan(ax+b) + C; ∫e^(ax+b)dx = (1/a)e^(ax+b) + C. For definite integrals using substitution, change limits to u-values.' },
  ],
  flashcards: [
    { id: 'int-f1', term: 'Indefinite Integral', definition: '∫f(x)dx = F(x)+C', example: '∫3x²dx = x³+C.' },
    { id: 'int-f2', term: 'Power Rule', definition: '∫xⁿdx = xⁿ⁺¹/(n+1)+C (n≠−1)', example: '∫x⁴dx = x⁵/5+C.' },
    { id: 'int-f3', term: 'FTC', definition: '∫ₐᵇ f(x)dx = F(b)−F(a)', example: '∫₁³ 2x dx = [x²]₁³ = 9−1 = 8.' },
    { id: 'int-f4', term: 'Area under curve', definition: '∫ₐᵇ f(x)dx if f(x)≥0', example: '∫₀³ x²dx = 9.' },
    { id: 'int-f5', term: 'Area between curves', definition: '∫ₐᵇ [f(x)−g(x)]dx', example: 'x² vs x on [0,1]: ∫(x−x²)dx = 1/6.' },
    { id: 'int-f6', term: 'Volume of Revolution', definition: 'V = π∫ₐᵇ [f(x)]²dx', example: 'y=√x, x∈[0,4]: V=π∫₀⁴ x dx=8π.' },
    { id: 'int-f7', term: 'Reverse Chain Rule', definition: '∫g\'(x)·f(g(x))dx = F(g(x)) + C where F\'=f', example: '∫2x·cos(x²)dx = sin(x²) + C.' },
    { id: 'int-f8', term: '∫sec²x dx', definition: '∫sec²x dx = tan x + C', example: '∫sec²(2x)dx = (1/2)tan(2x) + C.' },
    { id: 'int-f9', term: 'Volume of Revolution about y-axis', definition: 'V = π∫ₐᵇ x² dy where x is a function of y', example: 'y = x² from y=0 to y=4: V = π∫₀⁴ y dy = 8π.' },
    { id: 'int-f10', term: '∫(ax+b)ⁿ dx', definition: '∫(ax+b)ⁿ dx = (ax+b)ⁿ⁺¹/(a(n+1)) + C (n≠−1)', example: '∫(2x+1)³ dx = (2x+1)⁴/8 + C.' },
  ],
  questions: [
    { id: 'int-q1', stem: '∫(6x²−4x+3)dx?', choices: ['2x³−2x²+3x+C', '6x³−4x²+3x+C', '12x−4+C', '2x³−4x+3+C'], correctIndex: 0, explanation: 'Term by term: 2x³−2x²+3x+C.' },
    { id: 'int-q2', stem: '∫₀² (3x²+1)dx?', choices: ['10', '8', '14', '6'], correctIndex: 0, explanation: '[x³+x]₀² = 8+2−0 = 10.' },
    { id: 'int-q3', stem: '∫sin(4x)dx?', choices: ['cos(4x)+C', '−(1/4)cos(4x)+C', '(1/4)cos(4x)+C', '−4cos(4x)+C'], correctIndex: 1, explanation: '∫sin(ax)=−(1/a)cos(ax)+C.' },
    { id: 'int-q4', stem: '∫₁ᵉ (1/x)dx?', choices: ['0', '1', 'e', 'e−1'], correctIndex: 1, explanation: '[ln|x|]₁ᵉ = 1−0 = 1.' },
    { id: 'int-q5', stem: 'Area between y=x² and y=x on [0,1]?', choices: ['1/6', '1/3', '1/2', '1/12'], correctIndex: 0, explanation: '∫₀¹(x−x²)dx = 1/2−1/3 = 1/6.' },
    { id: 'int-q6', stem: 'Volume: y=2x rotated around x-axis, x∈[0,3]?', choices: ['12π', '36π', '18π', '72π'], correctIndex: 1, explanation: 'π∫₀³4x²dx = π[4x³/3]₀³ = 36π.' },
    { id: 'int-q7', stem: 'Which statement about integration is NOT always true?', choices: ['∫[f(x)+g(x)]dx = ∫f(x)dx + ∫g(x)dx', '∫x·f(x)dx = x·∫f(x)dx', '∫k·f(x)dx = k·∫f(x)dx', 'd/dx[∫f(x)dx] = f(x)'], correctIndex: 1, explanation: 'Integration distributes over addition and constant multiplication, but NOT over multiplication. The integral of a product is not the product of the integrals. This is a common misconception—there is no simple reverse of the product rule.' },
    { id: 'int-q8', stem: 'Given f\'(x) = 6x² − 4x and f(1) = 3, find f(2).', choices: ['11', '8', '5', '14'], correctIndex: 0, explanation: 'f(x) = 2x³ − 2x² + C. Using f(1)=3: 3 = 2−2+C → C=3. So f(2)=16−8+3=11. Choice 8 comes from forgetting +C; choice 5 from an arithmetic error in finding C.' },
    { id: 'int-q9', stem: '∫sec²(3x)dx?', choices: ['tan(3x)+C', '(1/3)tan(3x)+C', '3tan(3x)+C', 'tan(x)+C'], correctIndex: 1, explanation: '∫sec²(ax)dx = (1/a)tan(ax)+C. Here a=3, so divide by 3. Choice A forgets the 1/a factor; choice C multiplies by a instead; choice D ignores the 3x entirely.' },
    { id: 'int-q10', stem: 'Find the area enclosed by y = x² and y = 2x.', choices: ['4/3', '8/3', '4', '−4/3'], correctIndex: 0, explanation: 'Intersection at x=0 and x=2. Area = ∫₀²(2x−x²)dx = [x²−x³/3]₀² = 4−8/3 = 4/3. Choice B is the area under the line only; choice C integrates the wrong function; choice D has a sign error.' },
    { id: 'int-q11', stem: 'The region bounded by y = x², the y-axis, and y = 4 is rotated 2π about the y-axis. Find the volume of revolution.', choices: ['8π', '32π/5', '16π', '4π'], correctIndex: 0, explanation: 'V = π∫₀⁴ x² dy = π∫₀⁴ y dy = π[y²/2]₀⁴ = 8π. Choice B is what you get if you mistakenly rotate about the x-axis (π∫₀²(x²)²dx = 32π/5). Choice C forgets the 1/2 from integration.' },
    { id: 'int-q12', stem: 'A particle moves with velocity v(t) = t² − 4t + 3 m/s for 0 ≤ t ≤ 3. Find the total distance travelled.', choices: ['8/3 m', '0 m', '4/3 m', '−8/3 m'], correctIndex: 0, explanation: 'v(t) = (t−1)(t−3), so v>0 on [0,1) and v<0 on (1,3]. Split the integral: ∫₀¹(t²−4t+3)dt + ∫₁³−(t²−4t+3)dt = 4/3 + 4/3 = 8/3. Choice B is the displacement (net zero); choice C only counts the first interval; choice D has a sign error.' },
  ],
};

export default mathDPIntegration;
