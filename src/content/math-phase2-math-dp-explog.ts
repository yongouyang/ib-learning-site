import { Topic } from './types';

const mathDPExpLog: Topic = {
  id: 'math-dp-explog',
  subjectId: 'math',
  title: 'Exponential & Logarithmic Functions',
  description: 'Graphs of exponential and logarithmic functions, growth and decay models, transformations, and solving equations.',
  ibLevel: 'DP',
  notes: [
    { id: 'ell-n1', heading: 'Graphs of Exponential Functions', body: 'y=aˣ (a>0,a≠1): passes through (0,1); x-axis is horizontal asymptote; always positive. a>1: growth; 0<a<1: decay. y=eˣ: gradient equals value; passes through (0,1),(1,e),(−1,1/e). y=e^(−x) is reflection in y-axis.' },
    { id: 'ell-n2', heading: 'Graphs of Logarithmic Functions', body: 'y=logₐ(x): inverse of y=aˣ. Passes through (1,0) and (a,1). Domain x>0. y-axis is vertical asymptote. a>1: increasing. y=ln x: passes through (1,0),(e,1); vertical asymptote x=0.' },
    { id: 'ell-n3', heading: 'Growth and Decay Models', body: 'y=Aeᵏᵗ. k>0: growth. k<0: decay (approaches 0). Half-life: T½=ln2/k. Continuous compound interest: A=Pe^(rt). Determine parameters by substituting known points.' },
    { id: 'ell-n4', heading: 'Transformations and Solving', body: 'y=eˣ+k (vert shift, asymptote moves), y=e^(x−h) (horiz shift), y=Aeˣ (vert stretch), y=e^(kx) (rate change). Solve exponential: isolate, take ln. Solve log: combine via log laws, convert to exponential, check extraneous solutions.' },
    { id: 'ell-n5', heading: 'Logarithm Laws and Change of Base', body: 'For any base a>0, a≠1: logₐ(xy)=logₐx+logₐy; logₐ(x/y)=logₐx−logₐy; logₐ(xⁿ)=n·logₐx. Special values: logₐ1=0 and logₐa=1. Change of base formula: logₐb=ln b/ln a (also logₐb=log₁₀b/log₁₀a). This lets you evaluate any log on a calculator and is essential for solving equations like 3ˣ=7 → x=ln7/ln3.' },
  ],
  flashcards: [
    { id: 'ell-f1', term: 'y=eˣ features', definition: '(0,1); always positive; asymptote y=0; increasing.', example: 'x=1→y=e≈2.718' },
    { id: 'ell-f2', term: 'y=ln x features', definition: 'Domain x>0; (1,0),(e,1); asymptote x=0; increasing.', example: 'ln(e²)=2' },
    { id: 'ell-f3', term: 'Inverse relationship', definition: 'y=eˣ and y=ln x are inverses.', example: 'e^(ln5)=5; ln(e³)=3' },
    { id: 'ell-f4', term: 'Exponential decay model', definition: 'N(t)=N₀e^(−kt); half-life T½=ln2/k', example: 'k=0.02→T½≈34.7yr' },
    { id: 'ell-f5', term: 'Continuous compound interest', definition: 'A=Pe^(rt)', example: 'P=$2000, r=3%, t=10→≈$2699.72' },
    { id: 'ell-f6', term: 'Logarithm laws', definition: 'logₐ(xy)=logₐx+logₐy; logₐ(x/y)=logₐx−logₐy; logₐ(xⁿ)=n·logₐx', example: 'log₂(8×4)=log₂8+log₂4=3+2=5' },
    { id: 'ell-f7', term: 'Change of base formula', definition: 'logₐb = ln b / ln a', example: 'log₃7 = ln7/ln3 ≈ 1.771' },
    { id: 'ell-f8', term: 'Logarithmic scale', definition: 'A scale where equal intervals represent multiplicative changes (×10, ×100) rather than additive changes.', example: 'Richter scale: magnitude 6 is 10× stronger than magnitude 5.' },
    { id: 'ell-f9', term: 'Linearising exponential data', definition: 'If y=abˣ, taking logs gives ln y = ln a + x·ln b, which is linear in x.', example: 'Plotting ln y against x gives a straight line with gradient ln b and y-intercept ln a.' },
  ],
  questions: [
    { id: 'ell-q1', stem: 'Asymptote of y=3eˣ+2?', choices: ['y=0', 'y=2', 'y=3', 'y=5'], correctIndex: 1, explanation: 'As x→−∞, eˣ→0 → y→2.' },
    { id: 'ell-q2', stem: 'y=ln x → y=ln(x−3): transformation?', choices: ['Left 3', 'Right 3', 'Stretch ×3', 'Up 3'], correctIndex: 1, explanation: 'x→x−3 shifts right 3.' },
    { id: 'ell-q3', stem: 'eˣ=7 → x≈?', choices: ['1.95', '2.02', '2.08', '1.85'], correctIndex: 0, explanation: 'ln7≈1.946≈1.95.' },
    { id: 'ell-q4', stem: 'P=1200e^(0.04t). Growth rate?', choices: ['4%/yr', '0.04%/yr', '1200%/yr', '40%/yr'], correctIndex: 0, explanation: 'k=0.04 = 4% continuous growth.' },
    { id: 'ell-q5', stem: 'ln(2x−1)=3 → x=?', choices: ['(e³+1)/2', '(e³−1)/2', 'e³+1', 'e³/2'], correctIndex: 0, explanation: '2x−1=e³ → x=(e³+1)/2.' },
    { id: 'ell-q6', stem: 'N=N₀e^(−0.05t). Time to 10%?', choices: ['36.1 yr', '46.1 yr', '13.9 yr', '20.0 yr'], correctIndex: 1, explanation: 'e^(−0.05t)=0.1 → t=ln10/0.05≈46.1.' },
    { id: 'ell-q7', stem: 'A car worth $25 000 depreciates by 8% each year. Its value after t years is V(t)=25000(0.92)ᵗ. How many years until it is worth half its original value?', choices: ['4.2 yr', '6.2 yr', '8.3 yr', '12.5 yr'], correctIndex: 2, explanation: 'Half of $25 000 is $12 500. Solve 25000(0.92)ᵗ=12500 → 0.92ᵗ=0.5 → t=ln0.5/ln0.92≈8.31 years.' },
    { id: 'ell-q8', stem: 'For f(x)=k·aˣ+c with a>1, which statement is always true?', choices: ['The horizontal asymptote is y=k', 'The graph passes through (0,k)', 'The horizontal asymptote is y=c', 'The graph is decreasing'], correctIndex: 2, explanation: 'As x→−∞, aˣ→0 so f(x)→c. Thus y=c is the horizontal asymptote. The y-intercept is (0, k+c), not (0,k), and since a>1 the graph is increasing (not decreasing).' },
    { id: 'ell-q9', stem: 'Which expression is equivalent to ln(6e²) − ln3?', choices: ['ln2 + 2', 'ln(3e²)', 'ln12', '2'], correctIndex: 0, explanation: 'ln(6e²)−ln3 = ln(6e²/3) = ln(2e²) = ln2 + ln(e²) = ln2 + 2.' },
    { id: 'ell-q10', stem: 'The number of bacteria in a culture is modelled by N(t)=200e^(0.15t), where t is in hours. How many hours until the population reaches 800?', choices: ['4.6 hr', '6.2 hr', '9.2 hr', '18.4 hr'], correctIndex: 2, explanation: 'Set 200e^(0.15t)=800 → e^(0.15t)=4 → 0.15t=ln4 → t=ln4/0.15≈1.386/0.15≈9.24 hours.' },
    { id: 'ell-q11', stem: 'What is the domain of f(x)=ln(5−2x)?', choices: ['x<5/2', 'x>5/2', 'x<−5/2', 'x>−5/2'], correctIndex: 0, explanation: 'The argument of a logarithm must be positive: 5−2x>0 → 5>2x → x<5/2. Common mistake: solving 5−2x>0 as x>5/2 (forgetting to reverse the inequality when dividing by a negative number).' },
    { id: 'ell-q12', stem: 'Solve 3ˣ=20, giving your answer to 2 decimal places.', choices: ['2.56', '2.73', '2.89', '3.00'], correctIndex: 1, explanation: 'Take ln of both sides: x·ln3=ln20 → x=ln20/ln3≈2.996/1.099≈2.73.' },
  ],
};

export default mathDPExpLog;
