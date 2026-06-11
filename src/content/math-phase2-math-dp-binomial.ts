import { Topic } from './types';

const mathDPBinomial: Topic = {
  id: 'math-dp-binomial',
  subjectId: 'math',
  title: 'The Binomial Theorem',
  description: "Pascal's triangle, binomial coefficients, expansion of (a+b)ⁿ, the general term, and finding specific terms.",
  ibLevel: 'DP',
  notes: [
    { id: 'bin-n1', heading: "Binomial Coefficients and Pascal's Triangle", body: "ⁿCᵣ = n!/(r!(n−r)!). Pascal's triangle: each entry = sum of two above. Row n gives coefficients for (a+b)ⁿ. Symmetry: ⁿCᵣ = ⁿCₙ₋ᵣ." },
    { id: 'bin-n2', heading: 'Binomial Expansion', body: '(a+b)ⁿ = Σ(r=0 to n) ⁿCᵣ·aⁿ⁻ʳ·bʳ. Number of terms = n+1. Example: (x+2)³ = x³+3x²(2)+3x(4)+8 = x³+6x²+12x+8.' },
    { id: 'bin-n3', heading: 'The General Term', body: 'Tᵣ₊₁ = ⁿCᵣ·aⁿ⁻ʳ·bʳ. r starts at 0: T₁=ⁿC₀·aⁿ, T₂=ⁿC₁·aⁿ⁻¹b, etc. Example: 4th term of (2x+3)⁵ → r=3: ⁵C₃·(2x)²·3³ = 1080x².' },
    { id: 'bin-n4', heading: 'Finding a Specific Term', body: 'Set power of x in general term = k, solve for r. Example: constant term in (x+1/x)⁶ → x^(6−2r)=x⁰ → r=3 → T₄=⁶C₃=20.' },
    { id: 'bin-n5', heading: 'Key Properties of Binomial Expansions', body: 'Setting a=b=1 gives the sum of all coefficients: ⁿC₀+ⁿC₁+…+ⁿCₙ = 2ⁿ. Setting a=1, b=−1 gives the alternating sum: ⁿC₀−ⁿC₁+ⁿC₂−… = 0. In every expansion, powers of the first term decrease by 1 each term while powers of the second term increase by 1, and the sum of powers in each term always equals n.' },
  ],
  flashcards: [
    { id: 'bin-f1', term: 'Binomial coefficient', definition: 'ⁿCᵣ = n!/(r!(n−r)!)', example: '⁸C₃ = 56' },
    { id: 'bin-f2', term: 'Binomial theorem', definition: '(a+b)ⁿ = Σ⁰ⁿ ⁿCᵣ·aⁿ⁻ʳ·bʳ', example: '(1+x)³ = 1+3x+3x²+x³' },
    { id: 'bin-f3', term: 'General term Tᵣ₊₁', definition: 'Tᵣ₊₁ = ⁿCᵣ·aⁿ⁻ʳ·bʳ', example: '(x+2)⁵: T₃=40x³' },
    { id: 'bin-f4', term: "Pascal's triangle", definition: 'Triangular array; row n = coefficients of (a+b)ⁿ', example: 'Row 4: 1,4,6,4,1' },
    { id: 'bin-f5', term: 'Sum of binomial coefficients', definition: 'The sum of all coefficients in row n equals 2ⁿ.', example: '⁴C₀+⁴C₁+⁴C₂+⁴C₃+⁴C₄ = 1+4+6+4+1 = 16 = 2⁴' },
    { id: 'bin-f6', term: 'Alternating sum of coefficients', definition: 'ⁿC₀ − ⁿC₁ + ⁿC₂ − ⁿC₃ + … + (−1)ⁿ·ⁿCₙ = 0', example: 'For n=4: 1 − 4 + 6 − 4 + 1 = 0' },
    { id: 'bin-f7', term: 'Number of terms', definition: 'The expansion of (a+b)ⁿ contains exactly n+1 terms.', example: '(a+b)⁵ has 6 terms, from r=0 to r=5.' },
    { id: 'bin-f8', term: 'Constant term', definition: 'The term independent of x — found by setting the overall power of x to zero.', example: 'In (x+1/x)⁶, the constant term is ⁶C₃ = 20.' },
  ],
  questions: [
    { id: 'bin-q1', stem: '⁷C₃ = ?', choices: ['21', '35', '42', '70'], correctIndex: 1, explanation: '7!/(3!4!) = 35.' },
    { id: 'bin-q2', stem: 'Coefficient of x³ in (1+x)⁵?', choices: ['5', '8', '10', '15'], correctIndex: 2, explanation: '⁵C₃ = 10.' },
    { id: 'bin-q3', stem: 'Coefficient of x² in (3−x)⁴:', choices: ['54', '36', '18', '9'], correctIndex: 0, explanation: '⁴C₂·3²·(−1)²=6·9·1=54.' },
    { id: 'bin-q4', stem: 'How many terms in (a+b)¹²?', choices: ['11', '12', '13', '24'], correctIndex: 2, explanation: 'n+1 = 13.' },
    { id: 'bin-q5', stem: '(1+0.02)⁶ ≈ ? (first 3 terms)', choices: ['1.12', '1.126', '1.13', '1.122'], correctIndex: 1, explanation: '1+6(0.02)+15(0.0004)=1.126.' },
    { id: 'bin-q6', stem: '(1+kx)⁴: coeff of x²=54. Find k.', choices: ['2', '3', '4', '5'], correctIndex: 1, explanation: '⁴C₂·k²=6k²=54→k=3.' },
    { id: 'bin-q7', stem: 'In the expansion of (a+b)ⁿ, which statement is always FALSE?', choices: ['The sum of coefficients is 2ⁿ', 'There are n+1 terms', 'The coefficient of aⁿb⁰ equals the coefficient of a⁰bⁿ', 'The expansion contains a term aⁿ⁺¹b⁻¹'], correctIndex: 3, explanation: 'Powers of a decrease from n to 0 and powers of b increase from 0 to n. No term can have a negative power or a power exceeding n.' },
    { id: 'bin-q8', stem: 'Find the coefficient of x⁵ in (x² + 2/x)⁷.', choices: ['280', '560', '140', '35'], correctIndex: 0, explanation: 'Tᵣ₊₁ = ⁷Cᵣ·(x²)⁷⁻ʳ·(2/x)ʳ = ⁷Cᵣ·2ʳ·x¹⁴⁻³ʳ. Set 14−3r=5 → r=3. Coefficient = ⁷C₃·2³ = 35×8 = 280.' },
    { id: 'bin-q9', stem: 'The probability of exactly r successes in 7 independent trials, each with success probability 0.3, is ⁷Cᵣ(0.3)ʳ(0.7)⁷⁻ʳ. What is the probability of exactly 2 successes?', choices: ['0.21', '0.25', '0.32', '0.44'], correctIndex: 2, explanation: '⁷C₂·(0.3)²·(0.7)⁵ = 21 × 0.09 × 0.16807 ≈ 0.3177 ≈ 0.32. This is a direct application of the binomial probability formula.' },
    { id: 'bin-q10', stem: 'What is the sum of all coefficients in the expansion of (2x + 1)⁵?', choices: ['32', '64', '243', '1024'], correctIndex: 2, explanation: 'Substitute x=1: (2·1+1)⁵ = 3⁵ = 243. When x=1, each term reduces to its coefficient, so the total equals the sum of all coefficients.' },
    { id: 'bin-q11', stem: 'Find the constant term in the expansion of (2x² + 1/x)⁶.', choices: ['15', '30', '60', '120'], correctIndex: 2, explanation: 'Tᵣ₊₁ = ⁶Cᵣ·(2x²)⁶⁻ʳ·(1/x)ʳ = ⁶Cᵣ·2⁶⁻ʳ·x¹²⁻³ʳ. For constant term: 12−3r=0 → r=4. T₅ = ⁶C₄·2² = 15×4 = 60.' },
    { id: 'bin-q12', stem: 'Find the coefficient of x³ in the expansion of (1 + x)⁴(1 − 2x).', choices: ['−8', '−4', '4', '8'], correctIndex: 0, explanation: 'Expand (1+x)⁴ = 1+4x+6x²+4x³+x⁴. Multiply by (1−2x): x³ terms come from 4x³·1 + 6x²·(−2x) = 4−12 = −8.' },
  ],
};

export default mathDPBinomial;
