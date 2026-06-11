import { Topic } from './types';

const mathDPFunctions: Topic = {
  id: 'math-dp-functions',
  subjectId: 'math',
  title: 'Functions',
  description: 'Function notation, domain and range, composite and inverse functions, transformations, and odd/even functions.',
  ibLevel: 'DP',
  notes: [
    { id: 'fun-n1', heading: 'Function Notation, Domain, Range', body: 'A function maps each domain element to exactly one codomain element. Domain: valid inputs. Range: actual outputs. Vertical line test checks if a graph is a function. Example: f(x)=√(x−2) → domain x≥2, range f(x)≥0.' },
    { id: 'fun-n2', heading: 'Composite and Inverse Functions', body: '(f∘g)(x)=f(g(x)): apply g first. Domain: x in domain of g where g(x) in domain of f. Inverse f⁻¹ reverses mapping: f(f⁻¹(x))=x. Graph of f⁻¹ is reflection in y=x. Exists only if f is one-to-one (horizontal line test). Find: y=f(x), swap x,y, solve for y.' },
    { id: 'fun-n3', heading: 'Transformations', body: 'y=f(x)+a: vertical translation by a. y=f(x−a): horizontal translation by a. y=af(x): vertical stretch by a. y=f(ax): horizontal compression by 1/a. y=−f(x): reflection in x-axis. y=f(−x): reflection in y-axis.' },
    { id: 'fun-n4', heading: 'Odd and Even Functions', body: 'Even: f(−x)=f(x) — symmetric about y-axis (x², cos x, |x|). Odd: f(−x)=−f(x) — 180° rotational symmetry about origin (x³, sin x, x). Most functions are neither.' },
    { id: 'fun-n5', heading: 'Piecewise Functions', body: 'A piecewise function uses different formulas on different intervals. To evaluate, first identify which interval the input belongs to, then use the corresponding formula. The domain is the union of all intervals. Graphs may have "jumps" at boundary points if the pieces do not match. Example: f(x) = { x+1 for x≤2; 3x−5 for x>2 }.' },
  ],
  flashcards: [
    { id: 'fun-f1', term: 'Function definition', definition: 'Each input maps to exactly one output.', example: 'f(x)=x² is a function; x=y² is not.' },
    { id: 'fun-f2', term: 'Composite (f∘g)(x)', definition: 'Apply g first, then f: f(g(x)).', example: 'f(x)=x+1, g(x)=x² → (f∘g)(x)=x²+1' },
    { id: 'fun-f3', term: 'Inverse f⁻¹(x)', definition: 'Reverses f. Graph is reflection in y=x.', example: 'f(x)=2x+3 → f⁻¹(x)=(x−3)/2' },
    { id: 'fun-f4', term: 'Horizontal line test', definition: 'f has inverse iff every horizontal line meets graph at most once.', example: 'f(x)=x² fails; restrict to x≥0 → f⁻¹=√x' },
    { id: 'fun-f5', term: 'Even function', definition: 'f(−x)=f(x); symmetric about y-axis.', example: 'x⁴−3x²' },
    { id: 'fun-f6', term: 'Odd function', definition: 'f(−x)=−f(x); 180° symmetric about origin.', example: 'x³−x' },
    { id: 'fun-f7', term: 'Piecewise function', definition: 'A function defined by different expressions on different intervals.', example: 'f(x) = { 2x for x<1; x+1 for x≥1 }' },
    { id: 'fun-f8', term: 'Self-inverse function', definition: 'A function that is its own inverse: f(f(x)) = x.', example: 'f(x) = 1/x is self-inverse because f⁻¹(x) = 1/x.' },
    { id: 'fun-f9', term: 'Domain of a composite function', definition: 'The set of x in domain of g such that g(x) is in domain of f.', example: 'f(x)=√x, g(x)=x−3 → domain of f∘g is x≥3.' },
    { id: 'fun-f10', term: 'Identity property', definition: 'Applying a function and then its inverse returns the original input.', example: 'f⁻¹(f(x)) = x and f(f⁻¹(x)) = x (within respective domains).' },
  ],
  questions: [
    { id: 'fun-q1', stem: 'f(x)=3x−2, g(x)=x². (f∘g)(2)=?', choices: ['7', '25', '10', '13'], correctIndex: 2, explanation: 'f(g(2))=f(4)=10.' },
    { id: 'fun-q2', stem: 'Domain of f(x)=√(x−4):', choices: ['x>4', 'x≥4', 'x<4', 'all real x'], correctIndex: 1, explanation: 'x−4≥0 → x≥4.' },
    { id: 'fun-q3', stem: 'f(x)=2x+5. f⁻¹(x)=?', choices: ['(x+5)/2', '(x−5)/2', '2x−5', '(5−x)/2'], correctIndex: 1, explanation: 'y=2x+5, swap: x=2y+5→y=(x−5)/2.' },
    { id: 'fun-q4', stem: 'Which is even?', choices: ['x³', 'x²+1', 'x³+x', 'x²+x'], correctIndex: 1, explanation: 'f(−x)=x²+1=f(x).' },
    { id: 'fun-q5', stem: 'y=f(x) → 3 right, 2 down:', choices: ['f(x+3)+2', 'f(x−3)−2', 'f(x+3)−2', 'f(x−3)+2'], correctIndex: 1, explanation: 'Right: x→x−3; down: −2.' },
    { id: 'fun-q6', stem: 'Range of f(x)=x²−4:', choices: ['y≥−4', 'y>−4', 'y≤−4', 'all real y'], correctIndex: 0, explanation: 'x²≥0 → x²−4≥−4.' },
    { id: 'fun-q7', stem: 'f(x)=√x and g(x)=x−3. What is the domain of (f∘g)(x)?', choices: ['x≥0', 'x≥3', 'x≤3', 'all real x'], correctIndex: 1, explanation: '(f∘g)(x)=√(x−3). The output of g must lie in the domain of f, so x−3≥0 → x≥3.' },
    { id: 'fun-q8', stem: 'Which function is self-inverse (f = f⁻¹)?', choices: ['f(x)=2x', 'f(x)=x²', 'f(x)=1/x', 'f(x)=x+1'], correctIndex: 2, explanation: 'For f(x)=1/x, solving y=1/x gives x=1/y, so f⁻¹(x)=1/x=f(x). Its graph is also symmetric about y=x.' },
    { id: 'fun-q9', stem: 'A taxi charges $3 for the first 2 km and $2 per additional km. Which piecewise function gives the cost C(d) in dollars for distance d km?', choices: ['C(d)=3 for d≤2, C(d)=2d for d>2', 'C(d)=3 for d≤2, C(d)=3+2(d−2) for d>2', 'C(d)=3d for d≤2, C(d)=2d for d>2', 'C(d)=2 for d≤2, C(d)=3+2d for d>2'], correctIndex: 1, explanation: 'The first 2 km cost a flat $3. Beyond that, each extra kilometre adds $2, so the cost is 3+2(d−2).' },
    { id: 'fun-q10', stem: 'f(x)=1/(x+2) and g(x)=x−1. Find (g∘f)(x).', choices: ['1/(x+2)−1', 'x+1', '1/(x+1)', 'x−3'], correctIndex: 0, explanation: '(g∘f)(x)=g(f(x))=g(1/(x+2))=1/(x+2)−1=(1−x−2)/(x+2)=(−x−1)/(x+2).' },
    { id: 'fun-q11', stem: 'f(x)=x²−4x+5 is restricted to x≤2 so it has an inverse. What is f⁻¹(x)?', choices: ['2−√(x−1)', '2+√(x−1)', '2−√(x+1)', '√(x−1)−2'], correctIndex: 0, explanation: 'Complete the square: f(x)=(x−2)²+1. With x≤2, solving y=(x−2)²+1 gives x−2=−√(y−1), so x=2−√(y−1). Hence f⁻¹(x)=2−√(x−1).' },
    { id: 'fun-q12', stem: 'A cup of coffee cools from 90°C according to T(t)=70×0.9ᵗ+20, where t is minutes. What temperature does it approach long-term?', choices: ['76.7°C', '20°C', '90°C', '0°C'], correctIndex: 1, explanation: 'As t→∞, 0.9ᵗ→0, so T→20°C. This horizontal asymptote represents the room temperature the coffee approaches but never goes below.' },
  ],
};

export default mathDPFunctions;
