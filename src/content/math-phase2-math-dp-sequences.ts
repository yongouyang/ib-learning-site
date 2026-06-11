import { Topic } from './types';

const mathDPSequences: Topic = {
  id: 'math-dp-sequences',
  subjectId: 'math',
  title: 'Sequences & Series',
  description: 'Arithmetic and geometric sequences, series sums, sigma notation, and applications including compound interest.',
  ibLevel: 'DP',
  notes: [
    { id: 'seq-n1', heading: 'Arithmetic Sequences and Series', body: 'An arithmetic sequence has constant common difference d. nth term: uₙ = u₁ + (n−1)d. Sum: Sₙ = n/2·(2u₁+(n−1)d) or n/2·(u₁+uₙ). Models simple interest and straight-line depreciation.' },
    { id: 'seq-n2', heading: 'Geometric Sequences and Series', body: 'A geometric sequence has constant common ratio r. nth term: uₙ = u₁·rⁿ⁻¹. Sum (r≠1): Sₙ = u₁(rⁿ−1)/(r−1). Models compound interest: FV = PV·(1+r)ⁿ, population growth, radioactive decay.' },
    { id: 'seq-n3', heading: 'Sum to Infinity', body: 'When |r|<1, infinite sum converges: S∞ = u₁/(1−r). If |r|≥1, series diverges. Always verify |r|<1 first. Example: 1+1/2+1/4+… → S∞ = 2.' },
    { id: 'seq-n4', heading: 'Sigma Notation', body: 'Σ(k=m to n) uₖ = uₘ+uₘ₊₁+…+uₙ. Linearity properties. When lower index ≠ 1, compute Σ(k=1 to n) − Σ(k=1 to m−1). Identify whether sum is arithmetic or geometric before applying a formula.' },
    { id: 'seq-n5', heading: 'Depreciation, Simple Interest & Compounding Periods', body: 'Compound interest with k compounding periods per year: FV = PV·(1+r/(100k))^(kn). k=1 (annually), 2 (half-yearly), 4 (quarterly), 12 (monthly). Depreciation is compound interest with subtraction: FV = PV·(1−r/100)^n. Simple interest pays only on the principal: FV = PV + PV·r·t = PV(1+rt) — this forms an arithmetic sequence. Always check whether a question asks for simple or compound interest.' },
  ],
  flashcards: [
    { id: 'seq-f1', term: 'Arithmetic nth term', definition: 'uₙ = u₁ + (n−1)d', example: 'u₁=7, d=3 → u₁₀ = 7+27 = 34' },
    { id: 'seq-f2', term: 'Arithmetic series sum', definition: 'Sₙ = n/2·(2u₁ + (n−1)d)', example: '3+7+11+…20 terms: S₂₀=820' },
    { id: 'seq-f3', term: 'Geometric nth term', definition: 'uₙ = u₁·rⁿ⁻¹', example: 'u₁=4, r=1/2 → u₅ = 1/4' },
    { id: 'seq-f4', term: 'Geometric series sum', definition: 'Sₙ = u₁(rⁿ−1)/(r−1)', example: 'u₁=2, r=3, n=4: S₄=80' },
    { id: 'seq-f5', term: 'Sum to infinity', definition: 'S∞ = u₁/(1−r), |r|<1 only', example: 'u₁=6, r=1/3 → S∞=9' },
    { id: 'seq-f6', term: 'Compound interest', definition: 'FV = PV·(1+r)ⁿ', example: '$1000 at 5% 3yr ≈ $1157.63' },
    { id: 'seq-f7', term: 'Simple interest', definition: 'Interest paid only on the original principal; forms an arithmetic sequence.', example: '$1000 at 5% simple for 3yr → $1000 + $150 = $1150.' },
    { id: 'seq-f8', term: 'Depreciation', definition: 'Value decreases by a fixed percentage each year: FV = PV·(1−r/100)^n.', example: 'Car $20 000, 15%/yr: after 2yr = $14 450.' },
    { id: 'seq-f9', term: 'Alternating geometric sequence', definition: 'When r < 0, terms alternate positive and negative.', example: '3, −6, 12, −24, … has r = −2.' },
    { id: 'seq-f10', term: 'Compounding periods', definition: 'k = periods per year. FV = PV·(1+r/(100k))^(kn).', example: '6% compounded monthly: k=12, rate per month = 0.5%.' },
  ],
  questions: [
    { id: 'seq-q1', stem: 'Arithmetic: u₄=18, u₇=30. Common difference?', choices: ['3', '4', '5', '6'], correctIndex: 1, explanation: '3d = 30−18 = 12 → d = 4.' },
    { id: 'seq-q2', stem: 'Sum of first 20 terms of 3+7+11+…?', choices: ['780', '800', '820', '840'], correctIndex: 2, explanation: 'u₁=3, d=4. S₂₀=10·(6+76)=820.' },
    { id: 'seq-q3', stem: 'Geometric: u₁=3, r=2. u₈=?', choices: ['192', '256', '384', '512'], correctIndex: 2, explanation: '3·2⁷ = 3·128 = 384.' },
    { id: 'seq-q4', stem: 'Convergent: u₁=12, r=1/4. S∞?', choices: ['15', '16', '48', '14'], correctIndex: 1, explanation: '12/(1−1/4) = 12/(3/4) = 16.' },
    { id: 'seq-q5', stem: '$5000 at 4% compound interest for 3 years?', choices: ['$5600', '$5616', '$5624', '$5632'], correctIndex: 2, explanation: '5000×1.04³ ≈ 5624.' },
    { id: 'seq-q6', stem: 'A student invests £2000 at a nominal annual rate of 3.6% compounded monthly. What is the value after 5 years?', choices: ['£2360', '£2387', '£2394', '£2408'], correctIndex: 2, explanation: 'FV = 2000·(1+0.003)^60 ≈ 2000·1.197 = £2394. Monthly compounding beats annual (≈£2387) and simple interest (≈£2360).' },
    { id: 'seq-q7', stem: 'A new laptop costs $1200 and depreciates by 20% each year. What is its value after 3 years?', choices: ['$576', '$600', '$614', '$768'], correctIndex: 2, explanation: 'FV = 1200·(0.8)³ = 1200·0.512 = $614.40. $600 is linear depreciation (wrong model), $768 is after only 2 years.' },
    { id: 'seq-q8', stem: 'Which of the following geometric sequences does NOT have a finite sum to infinity?', choices: ['u₁=8, r=1/2', 'u₁=5, r=−0.3', 'u₁=10, r=0.99', 'u₁=3, r=−1.2'], correctIndex: 3, explanation: 'S∞ exists only when |r|<1. Here |−1.2|=1.2 ≥ 1, so the series diverges. The others all have |r|<1.' },
    { id: 'seq-q9', stem: 'A geometric sequence has u₁=2 and r=−3. What is u₆?', choices: ['−486', '486', '−162', '162'], correctIndex: 0, explanation: 'u₆ = 2·(−3)⁵ = 2·(−243) = −486. The negative ratio makes terms alternate; odd powers of r are negative.' },
    { id: 'seq-q10', stem: 'A geometric sequence has u₁=4 and r=1.5. Which term is the first to exceed 100?', choices: ['8th', '9th', '10th', '11th'], correctIndex: 1, explanation: 'Solve 4·1.5^(n−1) > 100. Taking logs: n−1 > ln25/ln1.5 ≈ 7.94, so n > 8.94. The 9th term (≈102.5) is first to exceed 100.' },
    { id: 'seq-q11', stem: 'Ali invests $2000 for 4 years at 5% per year. How much more would he earn with compound interest (compounded annually) than with simple interest?', choices: ['$20', '$31', '$40', '$50'], correctIndex: 1, explanation: 'Simple interest: 2000 + 4×100 = $2400. Compound: 2000×1.05⁴ ≈ $2431. The difference is about $31. Compound interest earns "interest on interest," so it outperforms simple interest over time.' },
  ],
};

export default mathDPSequences;
