import { Topic } from './types';

const mathDPProbability: Topic = {
  id: 'math-dp-probability',
  subjectId: 'math',
  title: 'Probability Distributions',
  description: 'Discrete random variables, expected value and variance, binomial distribution, normal distribution, standardisation, inverse normal, linear combinations, sample mean distributions, and hypothesis testing.',
  ibLevel: 'DP',
  notes: [
    { id: 'prb-n1', heading: 'Discrete Random Variables', body: 'A discrete RV X takes countable values with P(X=x)≥0 and ΣP=1. Expected value: E(X)=Σ x·P(X=x). Variance: Var(X)=E(X²)−[E(X)]² where E(X²)=Σ x²P. SD=√Var. Properties: E(aX+b)=aE(X)+b; Var(aX+b)=a²Var(X).' },
    { id: 'prb-n2', heading: 'Binomial Distribution', body: 'X~B(n,p): n independent trials, success probability p. Conditions (FIST): Fixed n, Independent, Same p, Two outcomes. P(X=r)=ⁿCᵣ·pʳ·(1−p)ⁿ⁻ʳ. E(X)=np, Var(X)=np(1−p). GDC: binompdf for P(X=r), binomcdf for P(X≤r).' },
    { id: 'prb-n3', heading: 'Normal Distribution', body: 'X~N(μ,σ²): symmetric bell curve. 68% within ±1σ, 95% within ±2σ, 99.7% within ±3σ. Standard normal Z~N(0,1): Z=(X−μ)/σ. GDC: normalcdf for probabilities, invNorm for inverse (given probability, find value).' },
    { id: 'prb-n4', heading: 't-Distribution and Hypothesis Testing (AI HL)', body: 't-distribution used when σ unknown and n<30. t=(x̄−μ₀)/(s/√n). df=n−1. As df→∞, t→N(0,1). One-sample t-test: H₀: μ=μ₀ vs H₁: μ≠μ₀. Reject if |t|>t_crit or p-value<α. Chi-squared test for independence (AI): χ²=Σ(O−E)²/E, df=(rows−1)(cols−1).' },
    { id: 'prb-n5', heading: 'Linear Combinations and Sample Mean', body: 'For independent X and Y: E(aX±bY)=aE(X)±bE(Y) and Var(aX±bY)=a²Var(X)+b²Var(Y). Note: Var(aX−bY) still adds variances. Distinction: 2X doubles one observation (Var=4Var(X)), while X+X sums two independent observations (Var=2Var(X)). If X~N(μ,σ²), the sample mean X̄ of n observations is also normal: X̄~N(μ, σ²/n).' },
  ],
  flashcards: [
    { id: 'prb-f1', term: 'Discrete RV', definition: 'X takes countable values; P(X=x)≥0, ΣP=1.', example: 'X=heads in 3 flips: P(0)=1/8, P(1)=3/8, P(2)=3/8, P(3)=1/8.' },
    { id: 'prb-f2', term: 'Expected Value', definition: 'E(X)=Σ x·P(X=x)', example: 'P(X=1)=0.2, P(2)=0.5, P(3)=0.3→E=1.9.' },
    { id: 'prb-f3', term: 'Binomial B(n,p)', definition: 'P(X=r)=ⁿCᵣpʳ(1−p)ⁿ⁻ʳ; E=np, Var=np(1−p)', example: 'B(10,0.4): E=4, Var=2.4.' },
    { id: 'prb-f4', term: 'Normal N(μ,σ²)', definition: 'Bell curve; 68-95-99.7 rule.', example: 'N(100,225): μ=100, σ=15.' },
    { id: 'prb-f5', term: 'Standardisation', definition: 'Z=(X−μ)/σ converts to N(0,1).', example: 'N(20,9), X=23 → Z=1 → P(Z>1)≈0.159.' },
    { id: 'prb-f6', term: 'Inverse Normal', definition: 'Given P(X<k)=p, find k via invNorm(p,μ,σ).', example: 'N(50,16), P(X<k)=0.9→k≈55.1.' },
    { id: 'prb-f7', term: 'Variance Formula', definition: 'Var(X)=E(X²)−[E(X)]² where E(X²)=Σ x²P(X=x).', example: 'If E(X)=3 and E(X²)=12, then Var(X)=12−9=3.' },
    { id: 'prb-f8', term: 'Linear Combinations', definition: 'For independent X,Y: E(aX±bY)=aE(X)±bE(Y); Var(aX±bY)=a²Var(X)+b²Var(Y).', example: 'E(X)=5, Var(X)=3, E(Y)=−2, Var(Y)=4 → E(2X+5Y)=0, Var(2X+5Y)=12+100=112.' },
    { id: 'prb-f9', term: 'Sample Mean Distribution', definition: 'If X~N(μ,σ²), then X̄~N(μ,σ²/n).', example: 'X~N(80,36), n=9 → X̄~N(80,4), so SD(X̄)=2.' },
    { id: 'prb-f10', term: 'Continuous RV Property', definition: 'For any continuous RV, P(X=k)=0 for a specific value k. We only find probabilities over intervals.', example: 'For Y~N(20,25), P(Y=20)=0, but P(18≤Y<27)≈0.579.' },
  ],
  questions: [
    { id: 'prb-q1', stem: 'Discrete RV: P(X=1)=0.2, P(X=2)=0.5, P(X=3)=k. Find k.', choices: ['0.2', '0.3', '0.5', '0.7'], correctIndex: 1, explanation: '0.2+0.5+k=1 → k=0.3.' },
    { id: 'prb-q2', stem: 'E(X) for P(1)=0.2, P(2)=0.5, P(3)=0.3?', choices: ['1.9', '2.0', '2.1', '2.5'], correctIndex: 2, explanation: '0.2+1.0+0.9=2.1.' },
    { id: 'prb-q3', stem: 'X~B(8, 0.25). E(X)=?', choices: ['0.25', '1.5', '2', '3'], correctIndex: 2, explanation: 'np=8×0.25=2.' },
    { id: 'prb-q4', stem: 'X~N(60, 25). P(X<65)≈?', choices: ['0.841', '0.579', '1.000', '0.159'], correctIndex: 0, explanation: 'Z=(65−60)/5=1; P(Z<1)≈0.841.' },
    { id: 'prb-q5', stem: 'What % within μ±2σ?', choices: ['68%', '95%', '99.7%', '50%'], correctIndex: 1, explanation: '68% within ±1σ, 95% within ±2σ.' },
    { id: 'prb-q6', stem: 'X~B(n,0.2), E=6. Find n.', choices: ['20', '25', '30', '40'], correctIndex: 2, explanation: 'n×0.2=6 → n=30.' },
    { id: 'prb-q7', stem: 'Which scenario CANNOT be modelled by a binomial distribution?', choices: ['Number of heads in 20 fair coin flips', 'Number of sixes when a fair die is rolled 30 times', 'Number of yellow cars in a random sample of 50 from a large car park', 'Number of rolls needed to get the first six'], correctIndex: 3, explanation: 'A binomial distribution requires a fixed number of trials. "Number of rolls until the first six" has no fixed n, so it follows a geometric distribution instead. All other options have fixed n and constant p.' },
    { id: 'prb-q8', stem: 'A game costs $4 to play. The prize W has P(W=0)=0.5, P(W=2)=0.3, P(W=10)=0.2. What is the expected profit?', choices: ['Gain $2.60', 'Loss $1.40', 'Loss $4.00', 'Gain $1.40'], correctIndex: 1, explanation: 'E(W)=0×0.5+2×0.3+10×0.2=0+0.6+2.0=$2.60. Expected profit = E(W)−cost = 2.60−4.00 = −$1.40 (a loss of $1.40).' },
    { id: 'prb-q9', stem: 'X is a random variable with E(X)=8 and Var(X)=5. What is Var(3X−2)?', choices: ['13', '43', '45', '15'], correctIndex: 2, explanation: 'Var(aX+b)=a²Var(X). Here a=3, so Var(3X−2)=9×5=45. The constant −2 does not affect variance, and you must square the multiplier 3, not just multiply by 3.' },
    { id: 'prb-q10', stem: 'X~N(50, 16). A random sample of 4 observations is taken. Which distribution does the sample mean X̄ follow?', choices: ['N(50, 4)', 'N(50, 16)', 'N(12.5, 4)', 'N(200, 64)'], correctIndex: 0, explanation: 'If X~N(μ,σ²), then X̄~N(μ,σ²/n). Here μ=50, σ²=16, n=4, so X̄~N(50, 4). Distractor B forgets to divide by n; C wrongly divides the mean; D multiplies instead of dividing.' },
    { id: 'prb-q11', stem: 'X~B(10, 0.4). Which expression gives P(X ≥ 3)?', choices: ['1 − P(X ≤ 2)', '1 − P(X ≤ 3)', 'P(X ≤ 2)', 'P(X ≤ 3) − P(X ≤ 2)'], correctIndex: 0, explanation: 'P(X≥3)=1−P(X≤2). For a discrete distribution like binomial, P(X≥3) excludes 0, 1, and 2, so we subtract P(X≤2). Option B subtracts too much, C gives the wrong tail, and D calculates P(X=3).' },
    { id: 'prb-q12', stem: 'Battery life is normally distributed with mean 12 hours and standard deviation 2 hours. The company wants to set a guarantee time such that only 5% of batteries fail before it. What guarantee should they set?', choices: ['8.7 hours', '9.3 hours', '10.4 hours', '15.3 hours'], correctIndex: 0, explanation: 'Find k where P(X<k)=0.05. Using invNorm(0.05,12,2) gives k≈8.71 hours. This is below the mean because we want the lower tail. Distractor B uses the wrong tail or z-value; C forgets to multiply z by σ; D finds the upper 5% point.' },
  ],
};

export default mathDPProbability;
