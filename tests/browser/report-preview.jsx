import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import ReportPreview from "../../src/features/reports/ReportPreview.jsx";
import { fitProblems } from "../../src/features/reports/reportValues.js";
import "../../src/styles.css";
import "../../src/features/reports/reports.css";
const source = {
  kind: "current",
  loadedAt: 1788436800000,
  projectName: "Customer onboarding pilot",
  promises: {
    customerPromise:
      "Complete onboarding in one visit, with clear instructions.",
    investorPromise:
      "Deliver a sustainable service within the agreed pilot budget.",
    coworkerPromise: "Provide a manageable workload and dependable support.",
  },
  assumptions: [
    {
      id: "a",
      statement: "Customers will pay the planned price.",
      criticality: 85,
      evidence: 25,
      nextStep: "Test pricing with five prospective customers.",
      helpNeeded: "Introductions to customer decision-makers.",
    },
    {
      id: "b",
      statement: "Staff can complete onboarding in one visit.",
      criticality: 65,
      evidence: 40,
      nextStep: "Observe the next three pilot appointments.",
      helpNeeded: "Protected staff time.",
    },
    {
      id: "c",
      statement: "The service can operate within the pilot budget.",
      criticality: 75,
      evidence: 55,
      nextStep: "Validate costs using pilot workload.",
      helpNeeded: "Finance review.",
    },
    {
      id: "d",
      statement: "Support can cover peak demand.",
      nextStep: "Estimate peak volume and capacity.",
      helpNeeded: "Support lead input.",
    },
  ],
};
source.assumptions.push(
  {
    id: "e",
    statement: "Customers can find the service.",
    criticality: 60,
    evidence: 30,
  },
  { id: "f", statement: "Partners will support the pilot." },
);
export default function Fixture() {
  const [movement, setMovement] = useState(false);
  const [selected, setSelected] = useState([]);
  const [many, setMany] = useState(false);
  const [long, setLong] = useState(false);
  const [fit, setFit] = useState([]);
  const ref = useRef(null);
  useEffect(() => {
    const id = requestAnimationFrame(() => setFit(fitProblems(ref.current)));
    return () => cancelAnimationFrame(id);
  }, [long, selected, many, movement]);
  return (
    <>
      <button onClick={() => setMovement(!movement)}>Toggle movement</button>
      <button
        onClick={() => setSelected(selected.length ? [] : ["a", "b", "c", "d"])}
      >
        Toggle zero/four discussion items
      </button>
      <button onClick={() => setMany(!many)}>Toggle long legend</button>
      <button onClick={() => setLong(!long)}>Toggle oversized promise</button>
      <p role="status">
        {fit.length ? `Does not fit: ${fit.join(", ")}` : "Fits one page"}
      </p>
      <div className="workspace-content">
        <div className="report-preview-scroll">
          <div className="report-measure" ref={ref}>
            <ReportPreview
              movementReview={
                movement
                  ? {
                      capturedAt: 1788264000000,
                      assumptions: source.assumptions.map((row) => ({
                        ...row,
                        evidence: 80,
                      })),
                    }
                  : null
              }
              source={
                many
                  ? {
                      ...source,
                      assumptions: [
                        ...source.assumptions,
                        ...Array.from({ length: 18 }, (_, i) => ({
                          id: `extra-${i}`,
                          statement: `Additional assumption ${i + 7} with long wording to check explicit overflow.`,
                        })),
                      ],
                    }
                  : source
              }
              selected={selected}
              overrides={
                long ? { customerPromise: "Long promise. ".repeat(100) } : {}
              }
              generatedAt={1788436800000}
            />
          </div>
        </div>
      </div>
    </>
  );
}
createRoot(document.getElementById("root")).render(<Fixture />);
