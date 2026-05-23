import { TemplateSection } from "@/lib/types";

export interface SystemTemplate {
    id: string;
    name: string;
    category: string;
    description: string;
    icon: string;
    color: string;
    gpsValidation: boolean;
    features: string[];
    sections: TemplateSection[];
    version: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function field(
    id: string,
    label: string,
    type: "text" | "number" | "checkbox" | "select" | "photo" | "signature" | "route" | "accelerometer" | "timer" | "stopwatch" | "joint_angle",
    required = false,
    options?: string[],
    gyroCapture = false,
) {
    return { id, label, type, required, ...(options ? { options } : {}), ...(gyroCapture ? { gyroCapture } : {}) };
}

function section(id: string, name: string, fields: ReturnType<typeof field>[]): TemplateSection {
    return { id, name, fields } as TemplateSection;
}

const CONDITION = ["Excellent", "Good", "Fair", "Poor"];
const PASS_FAIL = ["Pass", "Fail", "N/A"];
const SECTION_SCORE = ["10 – Outstanding", "8 – Good", "6 – Satisfactory", "4 – Below Standard", "2 – Poor", "0 – Unacceptable"];
const DRIVE_SCORE   = ["10 – Excellent", "8 – Good", "6 – Adequate", "4 – Borderline", "2 – Unsatisfactory", "0 – Dangerous / Fail"];

// ─── Template 1 — Rental Inspection ──────────────────────────────────────────

const rentalSections: TemplateSection[] = [
    section("s1", "Property Details", [
        field("f1", "Property address", "text", true),
        field("f2", "Property type", "select", true, ["House", "Apartment", "Unit", "Townhouse"]),
        field("f3", "Inspection date", "text", true),
        field("f4", "Inspector name", "text", true),
        field("f5", "Tenant name", "text"),
        field("f6", "Landlord / Agent name", "text"),
    ]),
    section("s2", "Entry & Exterior", [
        field("f7", "Front door condition", "select", true, CONDITION),
        field("f8", "Front garden / yard", "select", false, CONDITION),
        field("f9", "Fencing", "select", false, CONDITION),
        field("f10", "Exterior walls", "select", false, CONDITION),
        field("f11", "Exterior photos", "photo"),
        field("f12", "Notes", "text"),
        field("f12s", "Section score (/10)", "select", true, SECTION_SCORE),
    ]),
    section("s3", "Living Areas", [
        field("f13", "Walls", "select", false, CONDITION),
        field("f14", "Ceiling", "select", false, CONDITION),
        field("f15", "Flooring", "select", false, CONDITION),
        field("f16", "Lighting functional", "checkbox"),
        field("f17", "Photos", "photo"),
        field("f18", "Notes", "text"),
        field("f18s", "Section score (/10)", "select", true, SECTION_SCORE),
    ]),
    section("s4", "Kitchen", [
        field("f19", "Benchtops", "select", false, CONDITION),
        field("f20", "Appliances", "select", false, CONDITION),
        field("f21", "Cupboards", "select", false, CONDITION),
        field("f22", "Sink & tapware", "select", false, CONDITION),
        field("f23", "Photos", "photo"),
        field("f24", "Notes", "text"),
        field("f24s", "Section score (/10)", "select", true, SECTION_SCORE),
    ]),
    section("s5", "Bathrooms", [
        field("f25", "Shower / bath", "select", false, CONDITION),
        field("f26", "Toilet", "select", false, CONDITION),
        field("f27", "Vanity", "select", false, CONDITION),
        field("f28", "Exhaust fan functional", "checkbox"),
        field("f29", "Photos", "photo"),
        field("f30", "Notes", "text"),
        field("f30s", "Section score (/10)", "select", true, SECTION_SCORE),
    ]),
    section("s6", "Bedrooms", [
        field("f31", "Number of bedrooms", "number", true),
        field("f32", "Walls condition", "select", false, CONDITION),
        field("f33", "Flooring condition", "select", false, CONDITION),
        field("f34", "Built-in wardrobes present", "checkbox"),
        field("f35", "Photos", "photo"),
        field("f36", "Notes", "text"),
        field("f36s", "Section score (/10)", "select", true, SECTION_SCORE),
    ]),
    section("s7", "Utilities & Safety", [
        field("f37", "Smoke detectors present & working", "checkbox", true),
        field("f38", "Hot water system", "select", false, CONDITION),
        field("f39", "Heating / cooling", "select", false, CONDITION),
        field("f40", "Gas / electricity connected", "checkbox"),
        field("f41", "Notes", "text"),
        field("f41s", "Section score (/10)", "select", true, SECTION_SCORE),
    ]),
    section("s8", "Summary", [
        field("f42", "Overall property condition", "select", true, CONDITION),
        field("f42t", "Total score (/60)", "number", false),
        field("f43", "Action items", "text"),
        field("f44", "Inspector signature", "signature", true),
    ]),
];

// ─── Template 2 — Trades Report ───────────────────────────────────────────────

const tradesSections: TemplateSection[] = [
    section("s1", "Job Details", [
        field("f1", "Job type", "select", true, ["Electrical", "Plumbing", "Fitting & Turning", "Other"]),
        field("f2", "Client name", "text", true),
        field("f3", "Site address", "text", true),
        field("f4", "Job / work order number", "text"),
        field("f5", "Date", "text", true),
        field("f6", "Technician name", "text", true),
    ]),
    section("s2", "Before Work", [
        field("f7", "Pre-work condition description", "text"),
        field("f8", "Pre-work photos", "photo", true, undefined, true),
        field("f9", "Hazards identified", "checkbox"),
        field("f10", "Hazard description", "text"),
    ]),
    section("s3", "Work Completed", [
        field("f11", "Work description", "text", true),
        field("f12", "Materials used", "text"),
        field("f13", "Time started", "text"),
        field("f14", "Time completed", "text"),
        field("f15", "After work photos", "photo", true, undefined, true),
        field("f16", "Annotated diagram / sketch", "photo", false, undefined, true),
    ]),
    section("s4", "Measurements & Compliance", [
        field("f17", "Measurement label", "text"),
        field("f18", "Measurement value", "number"),
        field("f19", "Second measurement label", "text"),
        field("f20", "Second measurement value", "number"),
        field("f21", "Compliant to relevant standards", "checkbox", true),
        field("f22", "Standard / code reference", "text"),
    ]),
    section("s5", "Testing & Verification", [
        field("f23", "Tests performed", "text"),
        field("f24", "Test result", "select", true, PASS_FAIL),
        field("f25", "GPS-tagged evidence photo", "photo"),
        field("f26", "Notes", "text"),
    ]),
    section("s6", "Sign-off", [
        field("f27", "Additional notes", "text"),
        field("f28", "Technician signature", "signature", true),
        field("f29", "Client signature", "signature"),
    ]),
];

// ─── Template 3 — Legal & Forensic ────────────────────────────────────────────

const legalSections: TemplateSection[] = [
    section("s1", "Report Type & Incident", [
        field("f1", "Report type", "select", true, ["Forensics", "Police Incident", "General Legal"]),
        field("f2", "Case / incident number", "text", true),
        field("f3", "Date & time of incident", "text", true),
        field("f4", "Reporting officer / investigator", "text", true),
        field("f5", "Incident location", "text", true),
    ]),
    section("s2", "Scene Documentation", [
        field("f6", "Scene description", "text", true),
        field("f7", "Scene photos", "photo", true),
        field("f9", "Sketch / diagram", "photo"),
    ]),
    section("s3", "Evidence", [
        field("f10", "Evidence item description", "text"),
        field("f11", "Evidence photo", "photo"),
        field("f12", "Additional evidence item", "text"),
        field("f13", "Additional evidence photo", "photo"),
        field("f14", "Screenshot uploads", "photo"),
        field("f15", "Audio transcript / speech notes", "text"),
    ]),
    section("s4", "Persons Involved", [
        field("f16", "Persons involved", "text", true),
        field("f17", "Witness names", "text"),
        field("f18", "Witness statements", "text"),
    ]),
    section("s5", "Chain of Custody", [
        field("f19", "Evidence collected by", "text"),
        field("f20", "Collection timestamp", "text"),
        field("f21", "Storage location", "text"),
        field("f22", "Transferred to", "text"),
        field("f23", "Chain-of-custody photo", "photo"),
    ]),
    section("s6", "Notes & Actions", [
        field("f27", "Investigator notes", "text"),
        field("f28", "Recommendations", "text"),
        field("f29", "Follow-up actions", "text"),
        field("f30", "Supervisor signature", "signature"),
    ]),
];

// ─── Template 4 — Driving Test ────────────────────────────────────────────────

const drivingSections: TemplateSection[] = [
    section("s1", "Driver & Vehicle", [
        field("f1", "Driver name", "text", true),
        field("f2", "Licence number", "text", true),
        field("f3", "Vehicle registration", "text", true),
        field("f4", "Vehicle type", "select", true, ["Car", "Van", "Ambulance", "Bus", "Truck"]),
        field("f5", "Test date", "text", true),
        field("f6", "Assessor name", "text", true),
    ]),
    section("s2", "Pre-Drive Vehicle Check", [
        field("f7", "Lights functional", "checkbox", true),
        field("f8", "Mirrors adjusted", "checkbox", true),
        field("f9", "Seatbelt functional", "checkbox", true),
        field("f10", "Brakes responsive", "checkbox", true),
        field("f11", "Vehicle condition photos", "photo"),
        field("f11s", "Vehicle check score (/10)", "select", true, DRIVE_SCORE),
    ]),
    section("s3", "Route & GPS", [
        field("f12", "Route tracking", "route"),
        field("f13", "Start location", "text"),
        field("f14", "End location", "text"),
        field("f15", "Route notes", "text"),
    ]),
    section("s4", "Driving Behaviour", [
        field("f16", "Speed compliance", "select", true, CONDITION),
        field("f17", "Smoothness of acceleration", "select", true, CONDITION),
        field("f18", "Braking control", "select", true, CONDITION),
        field("f19", "Steering stability", "select", true, CONDITION),
        field("f20", "Hazard awareness", "select", true, CONDITION),
        field("f21", "Lane discipline", "select", false, CONDITION),
        field("f21s", "Driving behaviour score (/10)", "select", true, DRIVE_SCORE),
    ]),
    section("s5", "Sensor Analysis", [
        field("f22", "Vibration analysis", "accelerometer"),
        field("f23", "RMS", "number"),
        field("f24", "Peak", "number"),
        field("f25", "Avg", "number"),
        field("f26", "Sensor notes", "text"),
        field("f26s", "Sensor analysis score (/10)", "select", true, DRIVE_SCORE),
    ]),
    section("s6", "Assessment Summary", [
        field("f27", "Overall result", "select", true, ["Pass", "Fail", "Conditional Pass"]),
        field("f27t", "Total score (/30)", "number", false),
        field("f28", "Assessor comments", "text"),
        field("f29", "Areas for improvement", "text"),
        field("f30", "Assessor signature", "signature", true),
        field("f31", "Driver signature", "signature"),
    ]),
];

// ─── Template 5 — Patient Rehabilitation ──────────────────────────────────────

const JOINT_LIST = ["Knee", "Shoulder", "Elbow", "Hip", "Ankle", "Wrist", "Neck", "Lumbar"];
const MOVEMENT_TYPE = ["Flexion", "Extension", "Abduction", "Adduction", "Internal Rotation", "External Rotation", "Lateral Flexion"];
const REP_QUALITY = ["Full range", "Partial range", "Compensated", "Assisted"];
const REFLEX_RESPONSE = ["Normal", "Reduced", "Absent", "Hyperreflexic"];
const REFLEX_TESTS = ["Patellar (knee jerk)", "Bicep", "Tricep", "Achilles", "Brachioradialis", "Custom"];
const PROGRESS_SCALE = ["Significantly improved", "Improved", "Same", "Declined", "Significantly declined"];
const EFFORT_SCALE = ["Excellent", "Good", "Fair", "Poor"];
const SYMMETRY = ["Symmetric", "Mild asymmetry", "Marked asymmetry"];

const rehabSections: TemplateSection[] = [
    section("s1", "Patient & Session", [
        field("f1", "Patient name", "text", true),
        field("f2", "Patient ID", "text", true),
        field("f3", "Date of birth", "text"),
        field("f4", "Diagnosis / condition", "text", true),
        field("f5", "Clinician name", "text", true),
        field("f6", "Session number", "number", true),
        field("f7", "Session date", "text", true),
        field("f8", "Session type", "select", true, ["Physiotherapy", "Occupational Therapy", "Exercise Rehab", "Neurological", "Sports Rehab"]),
        field("f9", "Session duration", "timer"),
        field("f10", "Pain level (0–10)", "select", false, ["0","1","2","3","4","5","6","7","8","9","10"]),
    ]),
    section("s2", "Joint Movement Capture", [
        field("f1", "Joint assessed", "select", true, JOINT_LIST),
        field("f2", "Movement type", "select", true, MOVEMENT_TYPE),
        field("f3", "Start position — AI angle capture", "joint_angle"),
        field("f4", "End / max position — AI angle capture", "joint_angle"),
        field("f5", "Additional movement photos", "photo"),
        field("f6", "Capture notes", "text"),
    ]),
    section("s3", "Angle Measurements", [
        field("f1", "Baseline ROM from last session (°)", "number"),
        field("f2", "Current ROM — start angle (°)", "number"),
        field("f3", "Current ROM — end angle (°)", "number"),
        field("f4", "ROM improvement vs last session (°)", "number"),
        field("f5", "Symmetry assessment", "select", false, SYMMETRY),
        field("f6", "Measurement notes", "text"),
    ]),
    section("s4", "Repetition Performance", [
        field("f1", "Exercise name", "text", true),
        field("f2", "Target repetitions", "number"),
        field("f3", "Completed repetitions", "number"),
        field("f4", "Sets completed", "number"),
        field("f5", "Average rep duration (sec)", "number"),
        field("f6", "Rep quality", "select", false, REP_QUALITY),
        field("f7", "Resistance / load", "text"),
        field("f8", "Performance notes", "text"),
    ]),
    section("s5", "Reflex & Timing Analysis", [
        field("f1", "Reflex test type", "select", true, REFLEX_TESTS),
        field("f2", "Reaction time — trial 1 (ms)", "number"),
        field("f3", "Reaction time — trial 2 (ms)", "number"),
        field("f4", "Reaction time — trial 3 (ms)", "number"),
        field("f5", "Average reaction time (ms)", "number"),
        field("f6", "Reflex response", "select", false, REFLEX_RESPONSE),
        field("f7", "Reflex timing", "stopwatch"),
        field("f8", "Timing notes", "text"),
    ]),
    section("s6", "Session Progress Comparison", [
        field("f1", "Progress vs last session", "select", true, PROGRESS_SCALE),
        field("f2", "ROM change since intake (°)", "number"),
        field("f3", "Sessions completed to date", "number"),
        field("f4", "Patient effort level", "select", false, EFFORT_SCALE),
        field("f5", "Patient-reported pain change", "select", false, ["Reduced", "Same", "Increased"]),
        field("f6", "Functional milestone reached", "checkbox"),
        field("f7", "Milestone description", "text"),
        field("f8", "Comparison photos", "photo"),
    ]),
    section("s7", "Clinician Notes & Sign-off", [
        field("f1", "Clinical observations", "text", true),
        field("f2", "Treatment adjustments", "text"),
        field("f3", "Home exercise program updated", "checkbox"),
        field("f4", "Next session goals", "text"),
        field("f5", "Recommended next session date", "text"),
        field("f6", "Clinician signature", "signature", true),
        field("f7", "Patient signature", "signature"),
    ]),
];

// ─── Template 6 — General Report ─────────────────────────────────────────────

const generalSections: TemplateSection[] = [
    section("s1", "Report Details", [
        field("f1", "Title", "text", true),
        field("f2", "Date", "text", true),
        field("f3", "Author", "text", true),
        field("f4", "Category / subject", "text"),
    ]),
    section("s2", "Notes", [
        field("f5", "Main content", "text", true),
        field("f6", "Additional notes", "text"),
    ]),
    section("s3", "Media", [
        field("f7", "Photos", "photo"),
        field("f8", "Supporting photos", "photo"),
    ]),
];

// ─── Template 7 — Service Delivery ────────────────────────────────────────────

const deliverySections: TemplateSection[] = [
    section("s1", "Driver & Vehicle", [
        field("f1", "Driver name", "text", true),
        field("f2", "Vehicle registration", "text", true),
        field("f3", "Service type", "select", true, ["Rideshare", "Delivery", "Trades", "Other"]),
        field("f4", "Shift start time", "text", true),
    ]),
    section("s2", "Route & GPS", [
        field("f5", "Route tracking", "route"),
        field("f6", "Route notes", "text"),
    ]),
    section("s3", "Summary", [
        field("f7", "Notes", "text"),
        field("f8", "Issues encountered", "text"),
        field("f9", "Driver signature", "signature"),
    ]),
];

// ─── Exported catalogue ───────────────────────────────────────────────────────

export const SYSTEM_TEMPLATES: SystemTemplate[] = [
    {
        id: "sys_rental",
        name: "Rental Inspection",
        category: "Property",
        description: "Document property condition room-by-room for landlords, tenants, and agents.",
        icon: "home-outline",
        color: "#8b5cf6",
        gpsValidation: true,
        features: ["Room-by-room photos", "GPS-tagged images", "Condition scoring"],
        sections: rentalSections,
        version: 2,
    },
    {
        id: "sys_trades",
        name: "Trades Report",
        category: "Trades",
        description: "Verify work completed and compliance for electricians, plumbers, and fitters.",
        icon: "construct-outline",
        color: "#22c55e",
        gpsValidation: true,
        features: ["Before & after photos", "Measurement capture", "Compliance check"],
        sections: tradesSections,
        version: 1,
    },
    {
        id: "sys_legal",
        name: "Legal & Forensic",
        category: "Legal",
        description: "Evidence documentation for forensics and police incidents with chain-of-custody tracking.",
        icon: "shield-outline",
        color: "#ec4899",
        gpsValidation: true,
        features: ["Chain of custody", "Audio transcript", "GPS & timestamp verification"],
        sections: legalSections,
        version: 1,
    },
    {
        id: "sys_driving",
        name: "Driving Test",
        category: "Driving",
        description: "Evaluate driving behaviour, stability, and route compliance (e.g. ambulance driver assessments).",
        icon: "car-outline",
        color: "#f59e0b",
        gpsValidation: true,
        features: ["Accelerometer analysis", "GPS route tracking", "Stability scoring"],
        sections: drivingSections,
        version: 2,
    },
    {
        id: "sys_rehab",
        name: "Patient Rehabilitation",
        category: "Rehab",
        description: "Track patient recovery with gyroscope joint capture, rep performance, reflex timing, and session-over-session progress comparison.",
        icon: "fitness-outline",
        color: "#3b82f6",
        gpsValidation: false,
        features: ["Camera + gyro joint capture", "Rep & reflex timing", "Movement sensor analysis", "Session progress comparison"],
        sections: rehabSections,
        version: 1,
    },
    {
        id: "sys_general",
        name: "General Report",
        category: "General",
        description: "Flexible note-taking for journals, coaching, hobbies, or any field report.",
        icon: "create-outline",
        color: "#64748b",
        gpsValidation: false,
        features: ["Speech-to-text notes", "Photo attachments", "Free-form content"],
        sections: generalSections,
        version: 1,
    },
    {
        id: "sys_delivery",
        name: "Service Delivery",
        category: "Delivery",
        description: "Track driver routes, stop times, and delivery performance with GPS and notifications.",
        icon: "navigate-outline",
        color: "#06b6d4",
        gpsValidation: true,
        features: ["Live GPS route tracking", "Tap-to-record stops", "ETA & speed metrics"],
        sections: deliverySections,
        version: 1,
    },
];

export const CATEGORIES = [
    "All",
    "Property",
    "Trades",
    "Legal",
    "Driving",
    "Rehab",
    "General",
    "Delivery",
] as const;
