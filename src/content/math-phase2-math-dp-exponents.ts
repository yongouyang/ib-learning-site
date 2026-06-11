import { Topic } from './types';

const mathDPExponents: Topic = {
  id: 'math-dp-exponents',
  subjectId: 'math',
  title: 'Exponents & Logarithms',
  description: 'Laws of indices, definition and laws of logarithms, change of base, natural log, and solving exponential/logarithmic equations.',
  ibLevel: 'DP',
  notes: [
    { id: 'eel-n1', heading: 'Laws of Indices', body: 'aᵐ·aⁿ=aᵐ⁺ⁿ; aᵐ÷aⁿ=aᵐ⁻ⁿ; (aᵐ)ⁿ=aᵐⁿ; a⁰=1; a⁻ⁿ=1/aⁿ; a^(1/n)=ⁿ√a; a^(m/n)=(ⁿ√a)ᵐ.' },
    { id: 'eel-n2', heading: 'Definition and Laws of Logarithms', body: 'logₐ(b)=c ⟺ aᶜ=b (a>0, a≠1, b>0). Product: logₐ(xy)=logₐ(x)+logₐ(y). Quotient: logₐ(x/y)=logₐ(x)−logₐ(y). Power: logₐ(xⁿ)=n·logₐ(x). Change of base: logₐ(b)=log(b)/log(a).' },
    { id: 'eel-n3', heading: 'Natural Logarithm and Solving', body: 'ln(x)=logₑ(x). ln(eˣ)=x, e^(ln x)=x. Solve exponential: 3·2ˣ=48 → 2ˣ=16 → x=4. Solve log: log₂(x(x−2))=3 → x²−2x−8=0 → x=4 (reject −2).' },
    { id: 'eel-n4', heading: 'Exponential Growth and Decay', body: 'y=A·eᵏˣ. k>0 = growth; k<0 = decay. Half-life T½=ln2/k. Continuous compound interest: A=Pe^(rt). Always verify domain in log equations.' },
    { id: 'eel-n5', heading: 'Logarithmic Scales and Real-World Models', body: 'Many natural phenomena span huge ranges, so we use logarithmic scales. The Richter scale measures earthquake energy: R = log(A/A₀). A difference of 1 on the scale means 10× more amplitude. The decibel scale L = 10 log(I/I₀) measures sound intensity — every 10 dB increase means 10× more intense sound. pH = −log[H⁺] measures acidity. On any log scale, equal differences mean equal ratios, not equal amounts.' },
  ],
  flashcards: [
    { id: 'eel-f1', term: 'Definition of log', definition: 'logₐ(b)=c ⟺ aᶜ=b', example: 'log₂(8)=3 because 2³=8' },
    { id: 'eel-f2', term: 'Product law', definition: 'logₐ(xy) = logₐ(x) + logₐ(y)', example: 'log₃(9×27) = 2+3 = 5' },
    { id: 'eel-f3', term: 'Quotient law', definition: 'logₐ(x/y) = logₐ(x) − logₐ(y)', example: 'log₂(32/4) = 5−2 = 3' },
    { id: 'eel-f4', term: 'Power law', definition: 'logₐ(xⁿ) = n·logₐ(x)', example: 'log₂(8³) = 3×3 = 9' },
    { id: 'eel-f5', term: 'Change of base', definition: 'logₐ(b) = log(b)/log(a)', example: 'log₅(20) = ln20/ln5 ≈ 1.861' },
    { id: 'eel-f6', term: 'Half-life', definition: 'T½ = ln2/k for N(t)=N₀e^(−kt)', example: 'k=0.1 → T½≈6.93 years' },
    { id: 'eel-f7', term: 'Logarithmic scale', definition: 'A scale where equal steps represent equal ratios, not equal differences.', example: 'Richter scale: magnitude 6 is 10× stronger than 5 in wave amplitude.' },
    { id: 'eel-f8', term: 'Decibel level', definition: 'L = 10 log(I/I₀) where I₀ is the threshold of hearing.', example: '80 dB is 10× more intense than 70 dB.' },
    { id: 'eel-f9', term: 'Solving same-base exponentials', definition: 'If aˣ = aʸ then x = y (for a>0, a≠1).', example: '2^(3x−1) = 2⁵ → 3x−1=5 → x=2.' },
    { id: 'eel-f10', term: 'Common log misconception', definition: 'log(x+y) ≠ log(x) + log(y). The product law only applies to multiplication inside the log.', example: 'log(2+8)=log10=1, but log2+log8≈0.301+0.903=1.204. Not equal!' },
  ],
  questions: [
    { id: 'eel-q1', stem: '27^(2/3) = ?', choices: ['3', '6', '9', '18'], correctIndex: 2, explanation: '(∛27)² = 3² = 9.' },
    { id: 'eel-q2', stem: 'log₂(64) = ?', choices: ['4', '5', '6', '8'], correctIndex: 2, explanation: '2⁶=64.' },
    { id: 'eel-q3', stem: 'log(12) in terms of log(2), log(3):', choices: ['log2+log3', '2log2+log3', 'log2+2log3', '3log2−log3'], correctIndex: 1, explanation: '12=2²×3 → 2log2+log3.' },
    { id: 'eel-q4', stem: '3ˣ=45 → x≈?', choices: ['2.46', '3.09', '3.47', '3.91'], correctIndex: 2, explanation: 'ln45/ln3≈3.47.' },
    { id: 'eel-q5', stem: 'log₃(x)+log₃(x−6)=3 → x=?', choices: ['7', '9', '12', '27'], correctIndex: 1, explanation: 'x(x−6)=27 → x²−6x−27=0 → x=9.' },
    { id: 'eel-q6', stem: 'e^(ln 3) + ln(e³) = ?', choices: ['0', '3', '6', '9'], correctIndex: 2, explanation: '3 + 3 = 6.' },
    { id: 'eel-q7', stem: 'A concert speaker produces sound at 90 dB. A normal conversation is 60 dB. How many times more intense is the concert sound?', choices: ['3', '30', '100', '1000'], correctIndex: 3, explanation: 'Decibels use L = 10 log(I/I₀). A 30 dB difference means 10^(30/10) = 10³ = 1000× more intense. Each 10 dB step is a 10× multiplier, so three steps = 10×10×10 = 1000.' },
    { id: 'eel-q8', stem: 'Which of the following statements is ALWAYS true for a > 0, a ≠ 1 and x, y > 0?', choices: ['logₐ(x+y) = logₐ(x) + logₐ(y)', 'logₐ(x·y) = logₐ(x)·logₐ(y)', 'logₐ(x/y) = logₐ(x) − logₐ(y)', 'logₐ(xⁿ) = (logₐ x)ⁿ'], correctIndex: 2, explanation: 'The quotient law states logₐ(x/y) = logₐ(x) − logₐ(y). Choice A confuses sum with product; the product law says log(xy)=log(x)+log(y). Choice B confuses log of a product with product of logs. Choice D confuses log of a power with power of a log.' },
    { id: 'eel-q9', stem: 'An earthquake measures 6.0 on the Richter scale. Another measures 4.0. How many times greater is the wave amplitude of the larger earthquake?', choices: ['2', '10', '100', '1000'], correctIndex: 2, explanation: 'Richter scale: R = log(A/A₀). Difference = 6−4 = 2. Amplitude ratio = 10² = 100. Each whole number step on the Richter scale represents a 10-fold increase in wave amplitude.' },
    { id: 'eel-q10', stem: 'Solve for x: 5^(2x−1) = 125.', choices: ['1', '2', '3', '4'], correctIndex: 1, explanation: 'Write 125 as 5³. Since the bases are equal: 2x−1 = 3 → 2x = 4 → x = 2.' },
    { id: 'eel-q11', stem: 'The pH of a solution is defined as pH = −log[H⁺], where [H⁺] is hydrogen ion concentration. If lemon juice has [H⁺] = 1×10⁻² and milk has [H⁺] = 1×10⁻⁶, how many times more acidic is the lemon juice?', choices: ['4', '10', '100', '10000'], correctIndex: 3, explanation: 'pH of lemon juice = −log(10⁻²) = 2. pH of milk = −log(10⁻⁶) = 6. A difference of 4 pH units means 10⁴ = 10000× more acidic. Alternatively, ratio of [H⁺] = 10⁻²/10⁻⁶ = 10⁴ = 10000.' },
    { id: 'eel-q12', stem: 'Simplify (8x⁶)^(2/3).', choices: ['4x⁴', '12x⁴', '4x⁸', '16x¹²'], correctIndex: 0, explanation: '8^(2/3) = (∛8)² = 2² = 4. (x⁶)^(2/3) = x^(6×2/3) = x⁴. So the result is 4x⁴. A common mistake is to multiply 8×2/3=16/3 or to add exponents instead of multiplying.' },
  ],
};

export default mathDPExponents;
