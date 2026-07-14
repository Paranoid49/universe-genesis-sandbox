import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  type CausalGraph,
  type CausalNode,
  type UniverseSummary,
} from "../sim";
import {
  buildTracePaths,
  kindLabel,
  maximumRenderedPaths,
  nodeLabel,
  pickInitialNodeId,
  reachableNodes,
  reachablePreviewLimit,
  resultPageSize,
  rootNodeCount,
  type QueryDirection,
} from "./causalExplorerModel";
import { History, Search } from "./icons";
import { CausalRandomEvidence } from "./CausalRandomEvidence";

export type CausalExplorerNode = CausalNode;
export type CausalExplorerGraph = CausalGraph;

export type CausalExplorerProps = {
  universe: Pick<UniverseSummary, "name">;
  graph: CausalExplorerGraph;
  initialNodeId?: string;
  selectedNodeId?: string;
  sourceLabelById?: ReadonlyMap<string, string>;
  onNodeSelect?: (nodeId: string) => void;
  onReturn?: () => void;
};

export function CausalExplorer({ universe, graph, initialNodeId, selectedNodeId, sourceLabelById, onNodeSelect, onReturn }: CausalExplorerProps) {
  const searchInputId = useId();
  const causesPanelId = useId();
  const effectsPanelId = useId();
  const resultButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const directionButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const nodeById = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes]);
  const requestedNodeId = selectedNodeId ?? initialNodeId;
  const invalidRequestedNodeId = requestedNodeId && !nodeById.has(requestedNodeId) ? requestedNodeId : undefined;
  const initialSelectionId = useMemo(
    () => requestedNodeId && nodeById.has(requestedNodeId) ? requestedNodeId : pickInitialNodeId(graph),
    [graph, nodeById, requestedNodeId],
  );
  const [internalNodeId, setInternalNodeId] = useState(initialSelectionId);
  const [direction, setDirection] = useState<QueryDirection>("causes");
  const [query, setQuery] = useState("");
  const [visibleResultLimit, setVisibleResultLimit] = useState(resultPageSize);
  const [showAllReachable, setShowAllReachable] = useState(false);
  const activeNodeId = invalidRequestedNodeId
    ? ""
    : selectedNodeId && nodeById.has(selectedNodeId)
    ? selectedNodeId
    : nodeById.has(internalNodeId)
      ? internalNodeId
      : initialSelectionId;
  const activeNode = nodeById.get(activeNodeId);
  const resultNodes = useMemo(() => {
    const nonRootNodes = graph.nodes.filter((node) => !node.root);
    return nonRootNodes.length > 0 ? nonRootNodes : [...graph.nodes];
  }, [graph.nodes]);
  const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
  const filteredResultNodes = useMemo(() => {
    if (!normalizedQuery) return resultNodes;
    return resultNodes.filter((node) => [node.label, node.description, node.subjectId, kindLabel(node.kind)]
      .some((value) => value.toLocaleLowerCase("zh-CN").includes(normalizedQuery)));
  }, [normalizedQuery, resultNodes]);
  const visibleResultNodes = filteredResultNodes.slice(0, visibleResultLimit);

  if (invalidRequestedNodeId) {
    return (
      <section className="causal-explorer causal-explorer-empty" aria-label="因果查询目标无效" role="alert">
        <History size={20} />
        <h2>无法定位指定因果结果</h2>
        <p>目标无效、已过期或属于其他因果图。</p>
        <p>目标标识：<code>{invalidRequestedNodeId}</code></p>
      </section>
    );
  }

  if (!activeNode) {
    return (
      <section className="causal-explorer causal-explorer-empty" aria-label="因果查询">
        <History size={20} />
        <h2>因果查询暂不可用</h2>
        <p>当前宇宙还没有可查询的因果节点。</p>
      </section>
    );
  }

  const directRelationIds = direction === "causes" ? activeNode.directCauseIds : activeNode.directEffectIds;
  const directRelationNodes = directRelationIds.map((nodeId) => nodeById.get(nodeId)).filter((node): node is CausalNode => Boolean(node));
  const reachable = reachableNodes(activeNode.id, direction, nodeById);
  const visibleReachableNodes = showAllReachable ? reachable : reachable.slice(0, reachablePreviewLimit);
  const trace = buildTracePaths(activeNode.id, direction, nodeById);
  const relationTitle = direction === "causes" ? "直接原因" : "直接后果";
  const emptyRelationText = direction === "causes" ? "该节点是合法根因，没有更上游的原因。" : "该节点目前还没有产生可记录的后果。";
  const pathTitle = direction === "causes" ? "从根因到当前结果" : "从当前结果到后续影响";

  function selectNode(nodeId: string) {
    if (!nodeById.has(nodeId)) return;
    setInternalNodeId(nodeId);
    setShowAllReachable(false);
    onNodeSelect?.(nodeId);
  }

  function handleResultKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const lastIndex = visibleResultNodes.length - 1;
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? lastIndex
        : event.key === "ArrowDown"
          ? Math.min(index + 1, lastIndex)
          : Math.max(index - 1, 0);
    const nextNode = visibleResultNodes[nextIndex];
    if (!nextNode) return;
    selectNode(nextNode.id);
    resultButtonRefs.current[nextIndex]?.focus();
  }

  function handleDirectionKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === "ArrowLeft" || event.key === "Home" ? 0 : 1;
    const nextDirection: QueryDirection = nextIndex === 0 ? "causes" : "effects";
    setDirection(nextDirection);
    setShowAllReachable(false);
    directionButtonRefs.current[nextIndex]?.focus();
  }

  return (
    <section className="causal-explorer" aria-label={`${universe.name}的因果查询`}>
      <header className="causal-explorer-header">
        <div>
          <h2>因果查询</h2>
        </div>
        {onReturn && <button type="button" onClick={onReturn}>
          返回
        </button>}
        <dl className="causal-explorer-summary" aria-label="因果图摘要">
          <div><dt>节点</dt><dd>{graph.nodes.length}</dd></div>
          <div><dt>根因</dt><dd>{rootNodeCount(graph)}</dd></div>
          <div><dt>当前链路</dt><dd>{reachable.length + 1}</dd></div>
        </dl>
      </header>

      <div className="causal-explorer-layout">
        <div className="causal-result-picker" aria-label="结果选择">
          <label htmlFor={searchInputId}>选择要追溯的结果</label>
          <div className="causal-search-field">
            <Search size={15} />
            <input
              id={searchInputId}
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setVisibleResultLimit(resultPageSize);
              }}
              placeholder="搜索结果、对象或说明"
            />
          </div>
          <p>{filteredResultNodes.length} 个可查询结果，当前显示 {visibleResultNodes.length} 个，方向键可以连续浏览。</p>
          <div className="causal-result-list" aria-label="可查询结果">
            {visibleResultNodes.map((node, index) => (
              <button
                ref={(element) => { resultButtonRefs.current[index] = element; }}
                className={node.id === activeNode.id ? "active" : ""}
                key={node.id}
                type="button"
                aria-current={node.id === activeNode.id ? "true" : undefined}
                onClick={() => selectNode(node.id)}
                onKeyDown={(event) => handleResultKeyDown(event, index)}
              >
                <span>{kindLabel(node.kind)}</span>
                <strong>{node.label}</strong>
                <small>{node.description}</small>
              </button>
            ))}
            {filteredResultNodes.length === 0 && <p className="causal-no-results">没有匹配的因果结果。</p>}
            {visibleResultNodes.length < filteredResultNodes.length && (
              <button className="causal-load-more" type="button" onClick={() => setVisibleResultLimit((current) => current + resultPageSize)}>
                再显示 {Math.min(resultPageSize, filteredResultNodes.length - visibleResultNodes.length)} 个结果
              </button>
            )}
          </div>
        </div>

        <div className="causal-query-workspace">
          <article className="causal-node-detail" aria-live="polite">
            <div className="causal-node-heading">
              <span>{kindLabel(activeNode.kind)}</span>
              {activeNode.root && <em>合法根因</em>}
            </div>
            <h3>{activeNode.label}</h3>
            <p>{activeNode.description}</p>
            <dl>
              <div><dt>对象标识</dt><dd><code>{activeNode.subjectId}</code></dd></div>
              <div><dt>直接原因</dt><dd>{activeNode.directCauseIds.length}</dd></div>
              <div><dt>直接后果</dt><dd>{activeNode.directEffectIds.length}</dd></div>
              <div><dt>确定性抽样</dt><dd>{activeNode.randomSampleRefs.length}</dd></div>
            </dl>
            {activeNode.ruleIds.length > 0 && (
              <div className="causal-rule-list" aria-label="适用规则">
                <b>适用规则</b>
                <div>{activeNode.ruleIds.map((ruleId) => <span key={ruleId}>{sourceLabelById?.get(ruleId) ?? nodeById.get(ruleId)?.label ?? ruleId}</span>)}</div>
              </div>
            )}
            <CausalRandomEvidence references={activeNode.randomSampleRefs} trace={graph.randomTrace} />
          </article>

          <div className="causal-direction-tabs" role="tablist" aria-label="因果查询方向">
            <button
              ref={(element) => { directionButtonRefs.current[0] = element; }}
              id={`${causesPanelId}-tab`}
              type="button"
              role="tab"
              aria-selected={direction === "causes"}
              aria-controls={causesPanelId}
              tabIndex={direction === "causes" ? 0 : -1}
              className={direction === "causes" ? "active" : ""}
              onClick={() => {
                setDirection("causes");
                setShowAllReachable(false);
              }}
              onKeyDown={handleDirectionKeyDown}
            >
              为什么发生
            </button>
            <button
              ref={(element) => { directionButtonRefs.current[1] = element; }}
              id={`${effectsPanelId}-tab`}
              type="button"
              role="tab"
              aria-selected={direction === "effects"}
              aria-controls={effectsPanelId}
              tabIndex={direction === "effects" ? 0 : -1}
              className={direction === "effects" ? "active" : ""}
              onClick={() => {
                setDirection("effects");
                setShowAllReachable(false);
              }}
              onKeyDown={handleDirectionKeyDown}
            >
              产生了什么后果
            </button>
          </div>

          <section
            className="causal-query-panel"
            id={direction === "causes" ? causesPanelId : effectsPanelId}
            role="tabpanel"
            aria-labelledby={`${direction === "causes" ? causesPanelId : effectsPanelId}-tab`}
          >
            <div className="causal-direct-relations">
              <div>
                <h4>{relationTitle}</h4>
                <span>{directRelationNodes.length} 个</span>
              </div>
              {directRelationNodes.length > 0 ? (
                <div className="causal-related-list">
                  {directRelationNodes.map((node) => (
                      <button key={node.id} type="button" onClick={() => selectNode(node.id)}>
                        <span>{kindLabel(node.kind)}</span>
                        <strong>{node.label}</strong>
                        <small>{node.description}</small>
                      </button>
                  ))}
                </div>
              ) : <p className="causal-empty-relation">{emptyRelationText}</p>}
            </div>

            <div className="causal-reachable-nodes">
              <div>
                <h4>完整链路节点</h4>
                <span>{reachable.length} 个</span>
              </div>
              {reachable.length > 0 ? (
                <div>{visibleReachableNodes.map((node) => (
                  <button className="causal-node-chip" key={node.id} type="button" onClick={() => selectNode(node.id)}>
                    {node.label}
                  </button>
                ))}
                  {reachable.length > reachablePreviewLimit && (
                    <button className="causal-node-chip causal-expand-chain" type="button" onClick={() => setShowAllReachable((current) => !current)}>
                      {showAllReachable ? "收起链路节点" : `展开全部 ${reachable.length} 个节点`}
                    </button>
                  )}
                </div>
              ) : <p className="causal-empty-relation">当前方向没有其他可达节点。</p>}
            </div>

            <div className="causal-path-section">
              <div>
                <h4>{pathTitle}</h4>
                <span>{trace.paths.length}{trace.truncated ? "+" : ""} 条文字路径</span>
              </div>
              <div className="causal-path-list">
                {trace.paths.map((path, pathIndex) => {
                  const pathText = path.nodeIds.map((nodeId) => nodeLabel(nodeId, nodeById)).join(" → ");
                  return (
                    <div className="causal-path" key={`${path.nodeIds.join("-")}-${pathIndex}`} aria-label={`路径 ${pathIndex + 1}：${pathText}`}>
                      <span>路径 {pathIndex + 1}</span>
                      <div>
                        {path.nodeIds.map((nodeId, nodeIndex) => (
                          <span className="causal-path-step" key={`${nodeId}-${nodeIndex}`}>
                            {nodeIndex > 0 && <i aria-hidden="true">→</i>}
                            <button type="button" disabled={!nodeById.has(nodeId)} onClick={() => selectNode(nodeId)}>
                              {nodeLabel(nodeId, nodeById)}
                            </button>
                          </span>
                        ))}
                        {path.hasCycle && <em>因果闭环</em>}
                      </div>
                    </div>
                  );
                })}
              </div>
              {trace.truncated && <p className="causal-path-note">路径数量较多，当前展示前 {maximumRenderedPaths} 条；完整可达节点可在上方展开查看。</p>}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
