// Curriculum data for the PO projection tool (/po).
//
// Each level: a parent-friendly title, a one-line lead, and 2–3 readable bullets
// of what the level covers (plain-language summaries of the concept areas — written
// for parent-facing display, not copied from KSIS). `gradeAnchor` is an APPROXIMATE
// US grade equivalent used only to draw the growth chart — replace with the official
// KIS/ASHR grade-level benchmark values (Reference Library/WIG appendix) when ready.

export type Subject = "math" | "reading";

export interface Level {
  code: string;
  title: string;
  desc: string;
  bullets: string[];
  gradeAnchor: number; // approx US grade equivalent (K = 0, PreK ≈ -1). PLACEHOLDER.
}

export const MATH: Level[] = [
  { code: "7A", title: "Counting", desc: "Counting and recognizing numbers, building early number sense.", bullets: ["Counting and recognizing numbers up to 200", "Building early number sense"], gradeAnchor: -2 },
  { code: "6A", title: "Numbers to 100", desc: "Reading and counting numbers well past 100.", bullets: ["Counting and reading numbers past 100", "Confident number recognition"], gradeAnchor: -1.5 },
  { code: "5A", title: "Number Order", desc: "Reading numbers and putting them in sequence.", bullets: ["Reading numbers to 100 and beyond", "Putting numbers in the right order"], gradeAnchor: -1 },
  { code: "4A", title: "Writing Numbers", desc: "Tracing and writing numbers with confidence.", bullets: ["Tracing and writing numbers", "Number formation through 200"], gradeAnchor: -0.5 },
  { code: "3A", title: "First Addition", desc: "Numbers through 70, then the very first addition.", bullets: ["Numbers through 70", "The very first addition (+1, +2, +3)"], gradeAnchor: 0 },
  { code: "2A", title: "Adding", desc: "Building addition fluency toward larger sums.", bullets: ["Adding fluently up to larger sums", "Mental addition without counting on fingers"], gradeAnchor: 0.5 },
  { code: "A", title: "Addition & Subtraction", desc: "Fast, confident mental addition and subtraction — the foundation everything builds on.", bullets: ["Addition through larger numbers", "Introduction to subtraction", "Speed and accuracy, done mentally"], gradeAnchor: 1 },
  { code: "B", title: "Carrying & Borrowing", desc: "Multi-digit addition and subtraction with carrying and borrowing.", bullets: ["Multi-digit addition with carrying", "Subtraction with borrowing", "Bigger problems on paper and in the head"], gradeAnchor: 2 },
  { code: "C", title: "Multiplication & Division", desc: "Times tables, multi-digit multiplication, and an introduction to division.", bullets: ["Times tables to fluency", "Multi-digit multiplication", "Introduction to division"], gradeAnchor: 3 },
  { code: "D", title: "Long Division & Fractions", desc: "Longer multiplication and division, and the first taste of fractions.", bullets: ["Long multiplication and division", "Multiplication and division together", "First introduction to fractions"], gradeAnchor: 4 },
  { code: "E", title: "Fractions", desc: "Adding, subtracting, multiplying, and dividing fractions.", bullets: ["Adding and subtracting fractions", "Multiplying and dividing fractions", "Reducing and comparing fractions"], gradeAnchor: 5 },
  { code: "F", title: "Decimals & Operations", desc: "Fractions, decimals, and order of operations — finishing elementary calculation.", bullets: ["All four operations with fractions", "Decimals", "Order of operations and word problems"], gradeAnchor: 6 },
  { code: "G", title: "Algebra Begins", desc: "Positive and negative numbers and solving linear equations — the start of algebra.", bullets: ["Positive and negative numbers", "Algebraic expressions", "Solving linear equations"], gradeAnchor: 7.5 },
  { code: "H", title: "Equations & Factoring", desc: "Simultaneous equations, polynomials, and factoring.", bullets: ["Simultaneous equations", "Multiplying and factoring polynomials", "Using algebraic formulas"], gradeAnchor: 8.5 },
  { code: "I", title: "Quadratics & Functions", desc: "Square roots, quadratic equations, and graphing functions.", bullets: ["Square roots and quadratic equations", "Inequalities", "Graphing linear and quadratic functions"], gradeAnchor: 9.5 },
  { code: "J", title: "Advanced Algebra", desc: "Advanced factoring, quadratic and simultaneous equations, polynomial division.", bullets: ["Advanced factoring", "Quadratics and complex numbers", "Polynomial division and proofs"], gradeAnchor: 10.5 },
  { code: "K", title: "Functions Deepened", desc: "Quadratic, higher-degree, fractional, irrational, and exponential functions.", bullets: ["Quadratic and higher-degree functions", "Fractional and irrational functions", "Exponential functions"], gradeAnchor: 11 },
  { code: "L", title: "Intro to Calculus", desc: "Logarithmic functions, limits, derivatives, and integrals — early calculus.", bullets: ["Logarithmic functions", "Limits and derivatives", "Integrals, areas, and volumes"], gradeAnchor: 12 },
  { code: "M", title: "Trigonometry", desc: "Coordinate geometry, circles, and trigonometric functions.", bullets: ["Coordinate geometry and circles", "Trigonometric functions", "Laws of sines and cosines"], gradeAnchor: 12.5 },
  { code: "N", title: "Sequences & Limits", desc: "Sequences, series, limits, and differentiation.", bullets: ["Sequences and series", "Limits of functions", "Differentiation"], gradeAnchor: 13 },
  { code: "O", title: "Advanced Calculus", desc: "Advanced differentiation and integration, and differential equations — program completion.", bullets: ["Advanced differentiation and integration", "Differential equations", "Program completion"], gradeAnchor: 13.5 }
];

export const READING: Level[] = [
  { code: "7A", title: "First Words & Sounds", desc: "Connecting words to objects and hearing the sounds in words.", bullets: ["Connecting words to pictures", "Hearing the sounds inside words"], gradeAnchor: -2 },
  { code: "6A", title: "Rhyming", desc: "Recognizing familiar words and saying rhymes.", bullets: ["Recognizing familiar words", "Rhyming words and phrases"], gradeAnchor: -1.5 },
  { code: "5A", title: "Sounds to Stories", desc: "Blending letter sounds into words and first short stories.", bullets: ["Sounding out letters", "Blending sounds into words", "First short stories"], gradeAnchor: -1 },
  { code: "4A", title: "Blends & Fables", desc: "Consonant combinations and acting out simple fables.", bullets: ["Consonant blends", "Reading simple fables"], gradeAnchor: -0.5 },
  { code: "3A", title: "Patterns & Mini-Books", desc: "Sound patterns, compound words, and a child's first little books.", bullets: ["Sound patterns", "Compound words", "A child's first little books"], gradeAnchor: 0 },
  { code: "2A", title: "Reading Aloud", desc: "How words work in sentences, and reading aloud with fluency.", bullets: ["How words work in a sentence", "Reading aloud with fluency"], gradeAnchor: 0.5 },
  { code: "AI", title: "Simple Sentences", desc: "Who, what, where, and when — building and understanding short sentences.", bullets: ["Who, what, where, when", "Building short sentences", "Early vocabulary"], gradeAnchor: 1 },
  { code: "AII", title: "Story Sequence", desc: "Writing from memory and following the sequence of a story.", bullets: ["Writing from memory", "Following a story's sequence", "Words in context"], gradeAnchor: 1.5 },
  { code: "BI", title: "Sentence Parts", desc: "Subject and predicate, modifiers, and making clear statements.", bullets: ["Subject and predicate", "Modifiers", "Making clear statements"], gradeAnchor: 2 },
  { code: "BII", title: "Compare & Contrast", desc: "Spotting key details and comparing and contrasting ideas.", bullets: ["Spotting key details", "Comparing and contrasting", "Vocabulary in context"], gradeAnchor: 2.5 },
  { code: "CI", title: "Building Sentences", desc: "Constructing sentences and understanding characters' actions and intentions.", bullets: ["Constructing sentences", "Understanding actions and intentions", "Vocabulary"], gradeAnchor: 3 },
  { code: "CII", title: "Organizing Ideas", desc: "Organizing and integrating information from a passage.", bullets: ["Organizing information", "Integrating ideas from a passage", "Developing responses"], gradeAnchor: 3.5 },
  { code: "DI", title: "Into Paragraphs", desc: "Combining sentences and drawing statements from paragraphs.", bullets: ["Combining sentences", "Drawing statements from paragraphs", "Recommended reading"], gradeAnchor: 4 },
  { code: "DII", title: "Main Idea", desc: "Finding the topic and main idea and understanding paragraphs.", bullets: ["Topic and main idea", "Understanding paragraphs", "Vocabulary review"], gradeAnchor: 4.5 },
  { code: "EI", title: "Clauses & Charts", desc: "Working with clauses and graphing and charting information.", bullets: ["Working with clauses", "Graphing and charting information"], gradeAnchor: 5 },
  { code: "EII", title: "Reason & Result", desc: "Sequence and imagery, and cause-and-effect reasoning.", bullets: ["Sequence and imagery", "Cause and effect (reason & result)"], gradeAnchor: 5.5 },
  { code: "FI", title: "Interpreting Text", desc: "Referring words and interpreting what a text means.", bullets: ["Referring words", "Interpreting meaning", "Responding to questions"], gradeAnchor: 6 },
  { code: "FII", title: "Summarizing", desc: "Unraveling longer text and writing with concision.", bullets: ["Unraveling longer text", "Recounting events", "Writing with concision"], gradeAnchor: 6.5 },
  { code: "GI", title: "Paragraph Elements", desc: "Reading impressions and identifying the parts of a paragraph.", bullets: ["Reading impressions", "Identifying paragraph elements"], gradeAnchor: 7 },
  { code: "GII", title: "Summarizing (G)", desc: "Summarizing paragraphs using diagrams and comprehension checks.", bullets: ["Summarizing paragraphs with diagrams", "Comprehension checks"], gradeAnchor: 7.5 },
  { code: "HI", title: "Reading Perspective", desc: "Reading perspective, paragraph connections, and character variations.", bullets: ["Reading perspective", "Connecting paragraphs", "Character variations"], gradeAnchor: 8 },
  { code: "HII", title: "Summarizing (H)", desc: "Summarizing across paragraphs using key-word relationships.", bullets: ["Summarizing across paragraphs", "Key-word relationships"], gradeAnchor: 8.5 },
  { code: "II", title: "A Broader View", desc: "Reading with a broader view, expanding on ideas, and inference.", bullets: ["Reading with a broader view", "Expanding on ideas", "Inference"], gradeAnchor: 9 },
  { code: "III", title: "Summarizing (I)", desc: "Topics in context and explaining the summary process.", bullets: ["Topics in context", "Explaining the summary process"], gradeAnchor: 9.5 },
  { code: "J", title: "Critical Reading", desc: "An introduction to critical reading, passage structure, and character analysis.", bullets: ["Introduction to critical reading", "Passage structure", "Character analysis"], gradeAnchor: 10.5 },
  { code: "K", title: "Literary Analysis", desc: "Plot, setting, atmosphere, irony, and comedy.", bullets: ["Plot, setting, and atmosphere", "Irony and comedy", "Evaluating content"], gradeAnchor: 11.5 },
  { code: "L", title: "Critique", desc: "Figurative language, interpretation, tragedy, and critical writing — program completion.", bullets: ["Figurative language and interpretation", "Tragedy and critical writing", "Program completion"], gradeAnchor: 12.5 }
];

export function ladder(subject: Subject): Level[] {
  return subject === "reading" ? READING : MATH;
}

// The starting level + the next N levels (clamped so we never run past the top).
export function projectionFrom(subject: Subject, startCode: string, count = 3): Level[] {
  const arr = ladder(subject);
  let i = arr.findIndex((l) => l.code === startCode);
  if (i < 0) i = 0;
  i = Math.min(i, Math.max(0, arr.length - count));
  return arr.slice(i, i + count);
}
