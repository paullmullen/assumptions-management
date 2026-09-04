import { useId, useMemo } from "react";
import { Card, Empty, Tag, Typography } from "antd";

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
  assumptionList,
  readOnly = false,
  emphasizedIds = [],
  movement = [],
}) {
  const chartId = useId();
  const assessed = useMemo(() => assumptions.filter(isAssessed), [assumptions]);
  const unassessedCount = assumptions.length - assessed.length;
  const offsets = useMemo(() => collisionOffsets(assessed), [assessed]);
  function selectFromKeyboard(event, assumptionId) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(assumptionId, event.currentTarget);
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

      <div className="portfolio-layout">
        <div>
          {assessed.length === 0 ? (
            <Empty description="Assess an assumption to place it on the chart" />
          ) : (
            <div className="portfolio-chart-scroll">
              <svg
                aria-labelledby={`${chartId}-title ${chartId}-description`}
                className="portfolio-chart"
                role="group"
                viewBox="0 0 720 500"
              >
                <title id={`${chartId}-title`}>
                  Assumption portfolio chart
                </title>
                <desc id={`${chartId}-description`}>
                  Criticality increases from left to right. Evidence strengthens
                  from top to bottom. The clearest unretired risk is in the
                  upper-right. Numbered points correspond to the assumption
                  list.
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

                <defs>
                  <marker
                    id={`${chartId}-movement-arrow`}
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#536b60" />
                  </marker>
                </defs>
                <g
                  className="portfolio-movement"
                  pointerEvents="none"
                  aria-hidden="true"
                >
                  {movement
                    .filter((row) => row.changed)
                    .map((row) => {
                      const dx =
                        plotX(row.to.criticality) - plotX(row.from.criticality);
                      const dy =
                        plotY(row.to.evidence) - plotY(row.from.evidence);
                      const distance = Math.hypot(dx, dy);
                      const inset = Math.min(16, distance / 3);
                      return (
                        <g key={row.id}>
                          <line
                            x1={plotX(row.from.criticality)}
                            y1={plotY(row.from.evidence)}
                            x2={
                              plotX(row.to.criticality) -
                              (dx / distance) * inset
                            }
                            y2={
                              plotY(row.to.evidence) - (dy / distance) * inset
                            }
                            stroke="#536b60"
                            strokeWidth={row.id === selectedId ? 3 : 1.8}
                            markerEnd={`url(#${chartId}-movement-arrow)`}
                          />
                          <circle
                            cx={plotX(row.from.criticality)}
                            cy={plotY(row.from.evidence)}
                            r="6"
                            fill="white"
                            stroke="#536b60"
                            strokeWidth="2"
                          />
                        </g>
                      );
                    })}
                </g>
                {assessed.map((assumption) => {
                  const index = assumptions.findIndex(
                    (item) => item.id === assumption.id,
                  );
                  const originX = plotX(assumption.criticality);
                  const originY = plotY(assumption.evidence);
                  const offset = offsets.get(assumption.id);
                  const x = originX + offset.x;
                  const y = originY + offset.y;
                  const isSelected =
                    selectedId === assumption.id ||
                    emphasizedIds.includes(assumption.id);

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
                        aria-pressed={readOnly ? undefined : isSelected}
                        onClick={(event) =>
                          !readOnly &&
                          onSelect(assumption.id, event.currentTarget)
                        }
                        onKeyDown={(event) =>
                          !readOnly && selectFromKeyboard(event, assumption.id)
                        }
                        role={readOnly ? "img" : "button"}
                        tabIndex={readOnly ? undefined : 0}
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
          )}
          <div aria-label="Chart key" className="portfolio-key">
            <div className="portfolio-zone-key">
              <span className="portfolio-swatch portfolio-swatch-clearest" />
              <Text>Clearest unretired risk</Text>
              <span className="portfolio-swatch portfolio-swatch-watch" />
              <Text>Investigate and reduce uncertainty</Text>
              <span className="portfolio-swatch portfolio-swatch-lower" />
              <Text>Lower attention</Text>
            </div>
          </div>
        </div>
        {assumptionList}
      </div>
    </Card>
  );
}
