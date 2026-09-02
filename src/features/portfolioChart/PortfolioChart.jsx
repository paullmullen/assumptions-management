import { useMemo } from "react";
import { Card, Empty, Tag, Typography } from "antd";
import SelectedScoreEditor from "./SelectedScoreEditor.jsx";

const { Paragraph, Text } = Typography;

const PLOT = { left: 108, top: 28, width: 568, height: 408 };
const GRID_BREAKS = [33, 66];
const COLLISION_RADIUS = 11;

function isAssessed(assumption) {
  return (
    Number.isInteger(assumption.criticality) &&
    Number.isInteger(assumption.evidence)
  );
}

function plotX(criticality) {
  return PLOT.left + (criticality / 100) * PLOT.width;
}

function plotY(evidence) {
  return PLOT.top + (evidence / 100) * PLOT.height;
}

function polygonPoints(points) {
  return points
    .map(
      ([criticality, evidence]) => `${plotX(criticality)},${plotY(evidence)}`,
    )
    .join(" ");
}

function collisionOffsets(assumptions) {
  const groups = new Map();

  assumptions.forEach((assumption) => {
    const key = `${assumption.criticality}:${assumption.evidence}`;
    const group = groups.get(key) ?? [];
    group.push(assumption.id);
    groups.set(key, group);
  });

  return new Map(
    [...groups.values()].flatMap((ids) =>
      ids.map((id, index) => {
        if (ids.length === 1) {
          return [id, { x: 0, y: 0 }];
        }

        const angle = (2 * Math.PI * index) / ids.length - Math.PI / 2;
        return [
          id,
          {
            x: Math.cos(angle) * COLLISION_RADIUS,
            y: Math.sin(angle) * COLLISION_RADIUS,
          },
        ];
      }),
    ),
  );
}

export default function PortfolioChart({
  assumptions,
  selectedId,
  onSelect,
  onSaveScores,
  editingBusy = false,
}) {
  const assessed = useMemo(() => assumptions.filter(isAssessed), [assumptions]);
  const unassessedCount = assumptions.length - assessed.length;
  const offsets = useMemo(() => collisionOffsets(assessed), [assessed]);
  const selected = assumptions.find(
    (assumption) => assumption.id === selectedId,
  );

  function selectFromKeyboard(event, assumptionId) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(assumptionId);
    }
  }

  return (
    <Card
      className="portfolio-card"
      extra={<Tag>{unassessedCount} not assessed</Tag>}
      title="Assumption portfolio"
    >
      <Paragraph className="portfolio-introduction">
        The clearest unretired risks are toward the upper-right: serious
        consequences supported by weak evidence. As evidence strengthens,
        assumptions generally move downward.
      </Paragraph>

      {assessed.length === 0 ? (
        <Empty description="Assess an assumption to place it on the chart" />
      ) : (
        <div className="portfolio-layout">
          <div className="portfolio-chart-scroll">
            <svg
              aria-labelledby="portfolio-chart-title portfolio-chart-description"
              className="portfolio-chart"
              role="group"
              viewBox="0 0 720 500"
            >
              <title id="portfolio-chart-title">
                Assumption portfolio chart
              </title>
              <desc id="portfolio-chart-description">
                Criticality increases from left to right. Evidence strengthens
                from top to bottom. The clearest unretired risk is in the
                upper-right. Numbered points correspond to the assumption list.
              </desc>

              <rect
                className="portfolio-strong-evidence-zone"
                height={plotY(100) - plotY(66)}
                width={PLOT.width}
                x={PLOT.left}
                y={plotY(66)}
              />
              <polygon
                className="portfolio-zone portfolio-zone-lower"
                points={polygonPoints([
                  [0, 0],
                  [5, 0],
                  [51, 66],
                  [0, 66],
                ])}
              />
              <polygon
                className="portfolio-zone portfolio-zone-watch"
                points={polygonPoints([
                  [5, 0],
                  [51, 0],
                  [97, 66],
                  [51, 66],
                ])}
              />
              <polygon
                className="portfolio-zone portfolio-zone-clearest"
                points={polygonPoints([
                  [51, 0],
                  [100, 0],
                  [100, 66],
                  [97, 66],
                ])}
              />

              {GRID_BREAKS.map((score) => (
                <g key={`grid-${score}`}>
                  <line
                    className="portfolio-grid-line"
                    x1={plotX(score)}
                    x2={plotX(score)}
                    y1={PLOT.top}
                    y2={plotY(100)}
                  />
                  <line
                    className="portfolio-grid-line"
                    x1={PLOT.left}
                    x2={plotX(100)}
                    y1={plotY(score)}
                    y2={plotY(score)}
                  />
                </g>
              ))}
              <rect
                className="portfolio-plot-border"
                height={PLOT.height}
                width={PLOT.width}
                x={PLOT.left}
                y={PLOT.top}
              />

              <text className="portfolio-region-label" x={plotX(72)} y={50}>
                Clearest unretired risk
              </text>
              <text className="portfolio-axis-end" x={PLOT.left} y={465}>
                Manageable consequence
              </text>
              <text
                className="portfolio-axis-end"
                textAnchor="middle"
                x={plotX(49.5)}
                y={465}
              >
                Strategic change
              </text>
              <text
                className="portfolio-axis-end"
                textAnchor="end"
                x={plotX(100)}
                y={465}
              >
                Game over
              </text>
              <text
                className="portfolio-axis-title"
                textAnchor="middle"
                x={plotX(50)}
                y={491}
              >
                Criticality if wrong
              </text>
              {[
                { label: "Educated Guess", midpoint: 16.5 },
                { label: "Some Evidence", midpoint: 49.5 },
                { label: "Proven", midpoint: 83 },
              ].map(({ label, midpoint }) => (
                <text
                  key={label}
                  className="portfolio-axis-end"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  x={82}
                  y={plotY(midpoint)}
                  transform={`rotate(-90 82 ${plotY(midpoint)})`}
                >
                  {label}
                </text>
              ))}
              <text
                className="portfolio-axis-title"
                textAnchor="middle"
                transform={`rotate(-90 45 ${plotY(48)})`}
                x={24}
                y={232}
              >
                Strength of supporting evidence
              </text>

              {assessed.map((assumption, index) => {
                const originX = plotX(assumption.criticality);
                const originY = plotY(assumption.evidence);
                const offset = offsets.get(assumption.id);
                const x = originX + offset.x;
                const y = originY + offset.y;
                const isSelected = selectedId === assumption.id;

                return (
                  <g key={assumption.id}>
                    {(offset.x !== 0 || offset.y !== 0) && (
                      <line
                        className="portfolio-collision-line"
                        x1={originX}
                        x2={x}
                        y1={originY}
                        y2={y}
                      />
                    )}
                    <g
                      aria-label={`Assumption ${index + 1}: ${assumption.statement}. Criticality ${assumption.criticality}, evidence ${assumption.evidence}.`}
                      className={`portfolio-point${isSelected ? " portfolio-point-selected" : ""}`}
                      aria-pressed={isSelected}
                      onClick={() => onSelect(assumption.id)}
                      onKeyDown={(event) =>
                        selectFromKeyboard(event, assumption.id)
                      }
                      role="button"
                      tabIndex="0"
                      transform={`translate(${x} ${y})`}
                    >
                      <circle r="10" />
                      <text dy="0.35em" textAnchor="middle">
                        {index + 1}
                      </text>
                    </g>
                  </g>
                );
              })}
            </svg>
          </div>

          <div aria-label="Chart key" className="portfolio-key">
            <div className="portfolio-zone-key">
              <span className="portfolio-swatch portfolio-swatch-clearest" />
              <Text>Clearest unretired risk</Text>
              <span className="portfolio-swatch portfolio-swatch-watch" />
              <Text>Investigate and reduce uncertainty</Text>
              <span className="portfolio-swatch portfolio-swatch-lower" />
              <Text>Lower attention</Text>
            </div>

            <ol className="portfolio-assumption-key">
              {assessed.map((assumption, index) => (
                <li key={assumption.id}>
                  <button
                    aria-pressed={selectedId === assumption.id}
                    className="portfolio-key-button"
                    onClick={() => onSelect(assumption.id)}
                    type="button"
                  >
                    <span className="portfolio-key-number">{index + 1}</span>
                    <span>
                      {assumption.statement}
                      <small>
                        Criticality {assumption.criticality} · Evidence{" "}
                        {assumption.evidence}
                      </small>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      <SelectedScoreEditor
        assumption={selected}
        onSave={onSaveScores}
        disabled={editingBusy}
      />
    </Card>
  );
}
