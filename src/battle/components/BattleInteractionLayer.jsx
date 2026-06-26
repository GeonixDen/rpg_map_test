import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatTargetImpactLine } from '../lib/battleActionCards.js';
import { APP_CONFIG } from '../../config/appConfig.js';

const ACTION_PANEL_CONFIG = APP_CONFIG.battle?.actionPanel || {};

function numberOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

const ACTION_PANEL_WIDTH = numberOr(ACTION_PANEL_CONFIG.width, 188);
const ACTION_PANEL_GAP = numberOr(ACTION_PANEL_CONFIG.gap, 8);
const ACTION_PANEL_SCREEN_PADDING = numberOr(ACTION_PANEL_CONFIG.screenPadding, 12);
const ACTION_PANEL_VERTICAL_OFFSET = numberOr(ACTION_PANEL_CONFIG.verticalOffsetFactor, 0.62);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getCompactCooldownLabel(card) {
  if (!card) return '';
  if (card.type === 'attack') return 'Готово';
  return card.cooldown > 0 ? `КД ${card.cooldown}` : 'Готово';
}

function projectSpritePoint(sprite, viewport, scene, layerSize, verticalOffsetFactor = 0) {
  return {
    x: (
      viewport.left + (sprite.centerX / scene.width) * viewport.width
    ) * layerSize.width,
    y: (
      viewport.top + ((sprite.centerY - sprite.drawHeight * verticalOffsetFactor) / scene.height) * viewport.height
    ) * layerSize.height,
  };
}

function getActorAnchor(actorId, spriteByActorId, viewport, scene, layerSize, options = {}) {
  const sprite = spriteByActorId.get(actorId);
  if (!sprite) return null;

  const point = projectSpritePoint(
    sprite,
    viewport,
    scene,
    layerSize,
    options.verticalOffsetFactor ?? 0.58,
  );
  const xPadding = options.xPadding ?? 80;
  const minY = options.minY ?? 48;
  const maxY = options.maxY ?? (layerSize.height - 18);

  return {
    x: Math.round(clamp(point.x, xPadding, Math.max(xPadding, layerSize.width - xPadding))),
    y: Math.round(clamp(point.y, minY, maxY)),
  };
}

function getActorScreenAnchor(actorId, spriteByActorId, viewport, scene, layerRect, panelSize, uiScale = 1) {
  if (typeof window === 'undefined' || !layerRect) return null;

  const sprite = spriteByActorId.get(actorId);
  if (!sprite) return null;

  const point = projectSpritePoint(
    sprite,
    viewport,
    scene,
    {
      width: layerRect.width,
      height: layerRect.height,
    },
    ACTION_PANEL_VERTICAL_OFFSET,
  );
  const viewportPadding = ACTION_PANEL_SCREEN_PADDING;
  const panelGap = Math.round(ACTION_PANEL_GAP * uiScale);
  const fallbackPanelWidth = Math.max(
    1,
    Math.min(Math.round(ACTION_PANEL_WIDTH * uiScale), window.innerWidth - viewportPadding * 2),
  );
  const panelWidth = panelSize?.width || fallbackPanelWidth;
  const panelHeight = panelSize?.height || 0;
  const screenX = layerRect.left + point.x;
  const screenY = layerRect.top + point.y;
  const minX = viewportPadding + panelWidth / 2;
  const maxX = Math.max(minX, window.innerWidth - viewportPadding - panelWidth / 2);
  const minY = viewportPadding + panelHeight + panelGap;
  const maxY = Math.max(minY, window.innerHeight - viewportPadding);

  return {
    x: Math.round(clamp(screenX, minX, maxX)),
    y: Math.round(clamp(screenY, minY, maxY)),
  };
}

function getFloatingTooltipStyle(uiScale = 1) {
  if (typeof window === 'undefined') return null;

  const viewportPadding = 12;
  const width = Math.round(Math.min(
    Math.max(250, 300 * uiScale),
    window.innerWidth - viewportPadding * 2,
  ));

  return {
    top: `${viewportPadding}px`,
    right: `${viewportPadding}px`,
    width: `${width}px`,
    '--battle-ui-scale': uiScale,
  };
}

function buildCompactActionClassName(card, isActive) {
  return [
    'battle-test__actor-action-button',
    `battle-test__actor-action-button--${card.tone}`,
    isActive ? 'battle-test__actor-action-button--active' : '',
    card.blockedReason ? 'battle-test__actor-action-button--blocked' : '',
  ].filter(Boolean).join(' ');
}

function buildTooltipClassName(card) {
  return [
    'battle-test__actor-tooltip',
    'battle-test__actor-tooltip--detail',
    `battle-test__actor-tooltip--${card?.tone || 'utility'}`,
  ].filter(Boolean).join(' ');
}

function ArrowLayer({ layerSize, dragState, targetCenter }) {
  if (!dragState) return null;

  const endX = targetCenter?.x ?? dragState.pointer.x;
  const endY = targetCenter?.y ?? dragState.pointer.y;
  const controlY = Math.min(dragState.origin.y, endY) - 58;
  const path = `M ${dragState.origin.x} ${dragState.origin.y} Q ${(dragState.origin.x + endX) / 2} ${controlY}, ${endX} ${endY}`;

  return (
    <svg
      className="battle-test__aim-arrow"
      viewBox={`0 0 ${Math.max(1, layerSize.width)} ${Math.max(1, layerSize.height)}`}
      preserveAspectRatio="none"
    >
      <defs>
        <marker
          id="battle-test-arrowhead"
          markerWidth="10"
          markerHeight="10"
          refX="8"
          refY="4"
          orient="auto"
        >
          <path d="M0,0 L0,8 L8,4 z" fill="#ffd47d" />
        </marker>
      </defs>
      <path
        d={path}
        className="battle-test__aim-path"
        markerEnd="url(#battle-test-arrowhead)"
      />
    </svg>
  );
}

function CompactActionButtonComponent({ card, isActive, onPointerDown }) {
  const displayTitle = card.presentation?.displayTitle || card.title;
  const impactLine = card.presentation?.attackLine || card.summary?.damage;

  return (
    <button
      type="button"
      className={buildCompactActionClassName(card, isActive)}
      onPointerDown={(event) => onPointerDown(card, event)}
      disabled={Boolean(card.blockedReason)}
    >
      <div className="battle-test__actor-action-row">
        <strong>{displayTitle}</strong>
        <span>{getCompactCooldownLabel(card)}</span>
      </div>

      <div className="battle-test__actor-action-impact">
        {impactLine}
      </div>

      {card.blockedReason ? (
        <div className="battle-test__actor-action-lock">{card.blockedReason}</div>
      ) : null}
    </button>
  );
}

const CompactActionButton = memo(CompactActionButtonComponent, (prevProps, nextProps) => (
  prevProps.card === nextProps.card
  && prevProps.isActive === nextProps.isActive
));

function DetailTooltip({ card, target }) {
  if (!card) return null;

  const presentation = card.presentation || {};
  const serverTargetImpactLine = target ? card.targetImpacts?.[target.id]?.line : '';
  const hasServerTargetImpacts = Object.keys(card.targetImpacts || {}).length > 0;
  const targetImpactLine = serverTargetImpactLine || (!hasServerTargetImpacts && target
    ? formatTargetImpactLine(card.resolvedAction, target)
    : '');
  const geometryRows = Array.isArray(presentation.geometryRows) ? presentation.geometryRows : [];
  const appliesRows = Array.isArray(presentation.appliesRows)
    ? presentation.appliesRows.filter((row) => row !== '—')
    : [];
  const afterEffectLines = Array.isArray(presentation.afterEffectLines)
    ? presentation.afterEffectLines
    : [];

  return (
    <div className={buildTooltipClassName(card)}>
      <div className="battle-test__actor-tooltip-head">
        <strong>{presentation.displayTitle || card.title}</strong>
        <span>{presentation.metaLine || getCompactCooldownLabel(card)}</span>
      </div>

      {presentation.description ? (
        <p className="battle-test__actor-tooltip-description">{presentation.description}</p>
      ) : null}

      <div className="battle-test__actor-tooltip-line battle-test__actor-tooltip-line--primary">
        {targetImpactLine || presentation.attackLine || card.summary?.damage}
      </div>
      {targetImpactLine && presentation.attackLine ? (
        <div className="battle-test__actor-tooltip-line">База: {presentation.attackLine}</div>
      ) : null}
      <div className="battle-test__actor-tooltip-line">Цель: {card.summary?.target}</div>
      <div className="battle-test__actor-tooltip-line">Зона: {card.summary?.area}</div>

      {presentation.chainLine ? (
        <div className="battle-test__actor-tooltip-line">{presentation.chainLine}</div>
      ) : null}

      {geometryRows.length ? (
        <div className="battle-test__actor-tooltip-block">
          <div className="battle-test__actor-tooltip-label">
            {presentation.geometryLabel || 'Дальность:'}
          </div>
          <div className="battle-test__actor-tooltip-grid">
            {geometryRows.map((row, index) => (
              <div key={`${card.id}:geometry:${index}`} className="battle-test__actor-tooltip-grid-row">
                {row}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {appliesRows.length ? (
        <div className="battle-test__actor-tooltip-block">
          <div className="battle-test__actor-tooltip-label">
            {presentation.appliesLabel || 'Накладывает:'}
          </div>
          {appliesRows.map((row, index) => (
            <div key={`${card.id}:status:${index}`} className="battle-test__actor-tooltip-line">
              {row}
            </div>
          ))}
        </div>
      ) : null}

      {afterEffectLines.length ? (
        <div className="battle-test__actor-tooltip-block">
          {afterEffectLines.map((line, index) => (
            <div
              key={`${card.id}:after:${index}`}
              className={line.includes('⬛') || line.includes('💢')
                ? 'battle-test__actor-tooltip-grid-row'
                : line === 'Область:' || line === 'Накладывает:' || line.startsWith('⤵️')
                  ? 'battle-test__actor-tooltip-label'
                  : 'battle-test__actor-tooltip-line'}
            >
              {line}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SelectedActorPanel({
  anchor,
  actorName,
  actionCards,
  activeCardId,
  onCardPointerDown,
  onCancelSelection,
  onPanelSizeChange,
  uiScale = 1,
  floating = false,
  hidden = false,
}) {
  const panelRef = useRef(null);

  useEffect(() => {
    const node = panelRef.current;
    if (!node || hidden) return undefined;

    const reportSize = () => {
      const rect = node.getBoundingClientRect();
      onPanelSizeChange?.({
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    };

    reportSize();

    const resizeObserver = new ResizeObserver(reportSize);
    resizeObserver.observe(node);

    return () => {
      resizeObserver.disconnect();
    };
  }, [actionCards.length, hidden, onPanelSizeChange]);

  if (!anchor || actionCards.length === 0 || hidden) return null;

  return (
    <div
      ref={panelRef}
      className={[
        'battle-test__actor-panel',
        floating ? 'battle-test__actor-panel--floating' : '',
      ].filter(Boolean).join(' ')}
      style={{
        left: `${anchor.x}px`,
        top: `${anchor.y}px`,
        '--battle-ui-scale': uiScale,
        '--battle-action-panel-width': `${ACTION_PANEL_WIDTH}px`,
        '--battle-action-panel-gap': `${ACTION_PANEL_GAP}px`,
        '--battle-action-panel-screen-padding': `${ACTION_PANEL_SCREEN_PADDING}px`,
      }}
    >
      <div className="battle-test__actor-panel-shell">
        <div className="battle-test__actor-panel-head">
          <strong>{actorName || 'Действия'}</strong>
          <button
            type="button"
            className="battle-test__actor-panel-cancel"
            onClick={onCancelSelection}
          >
            Отмена
          </button>
        </div>

        <div className="battle-test__actor-actions">
          {actionCards.map((card) => (
            <CompactActionButton
              key={card.id}
              card={card}
              isActive={card.id === activeCardId}
              onPointerDown={onCardPointerDown}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function BattleInteractionLayer({
  scene,
  viewport = { left: 0, top: 0, width: 1, height: 1 },
  sprites,
  selectedActor,
  selectedActorId,
  selectableActorIds,
  actionCards,
  actionCardsByActorId = {},
  battleChars = [],
  armedCardId,
  targetableIds,
  unmaskTargetIds = [],
  uiScale = 1,
  onSelectActor,
  onArmCard,
  onCancelSelection,
  onExecuteAction,
  onExecuteUnmask,
  onHoverActorChange,
}) {
  const layerRef = useRef(null);
  const dragFrameRef = useRef(0);
  const dragQueuedRef = useRef(null);
  const suppressHitboxClickUntilRef = useRef(0);
  const [layerSize, setLayerSize] = useState({
    width: scene.width,
    height: scene.height,
  });
  const [pendingDragState, setPendingDragState] = useState(null);
  const [dragState, setDragState] = useState(null);
  const [passiveHoveredActorId, setPassiveHoveredActorId] = useState(null);
  const [lastTooltipSelection, setLastTooltipSelection] = useState(null);
  const [floatingTooltipStyle, setFloatingTooltipStyle] = useState(null);
  const [actorPanelSize, setActorPanelSize] = useState({ width: 0, height: 0 });
  const handleActorPanelSizeChange = useCallback((nextSize) => {
    setActorPanelSize((current) => (
      current.width === nextSize.width && current.height === nextSize.height
        ? current
        : nextSize
    ));
  }, []);

  const selectableSet = useMemo(() => new Set(selectableActorIds), [selectableActorIds]);
  const targetableSet = useMemo(() => new Set(targetableIds), [targetableIds]);
  const unmaskTargetSet = useMemo(() => new Set(unmaskTargetIds), [unmaskTargetIds]);
  const actorById = useMemo(
    () => new Map(battleChars.map((actor) => [actor.id, actor])),
    [battleChars],
  );
  const spriteByActorId = useMemo(
    () => new Map(sprites.map((sprite) => [sprite.charId, sprite])),
    [sprites],
  );
  const activeCard = useMemo(
    () => actionCards.find((card) => card.id === (dragState?.cardId || armedCardId)) || null,
    [actionCards, armedCardId, dragState?.cardId],
  );
  const hoveredActorId = dragState?.hoveredTargetId || passiveHoveredActorId || null;
  const activeCardId = dragState?.cardId || armedCardId || null;
  const tooltipTarget = useMemo(() => {
    if (!activeCard || !hoveredActorId || !targetableSet.has(hoveredActorId)) return null;
    return actorById.get(hoveredActorId) || null;
  }, [activeCard, actorById, hoveredActorId, targetableSet]);
  const tooltipCard = useMemo(() => {
    if (activeCard) return activeCard;

    if (lastTooltipSelection?.actorId && lastTooltipSelection?.cardId) {
      const tooltipCards = actionCardsByActorId[lastTooltipSelection.actorId] || [];
      const resolvedCard = tooltipCards.find((card) => card.id === lastTooltipSelection.cardId);
      if (resolvedCard) return resolvedCard;
    }

    return null;
  }, [actionCardsByActorId, activeCard, lastTooltipSelection]);

  useEffect(() => {
    const node = layerRef.current;
    if (!node) return undefined;

    const updateSize = () => {
      const nextWidth = node.clientWidth || scene.width;
      const nextHeight = node.clientHeight || scene.height;

      setLayerSize((current) => (
        current.width === nextWidth && current.height === nextHeight
          ? current
          : { width: nextWidth, height: nextHeight }
      ));
    };

    updateSize();

    const resizeObserver = new ResizeObserver(() => {
      updateSize();
    });

    resizeObserver.observe(node);

    return () => {
      resizeObserver.disconnect();
    };
  }, [scene.height, scene.width]);

  useEffect(() => {
    if (!selectedActor) {
      setPendingDragState(null);
      setDragState(null);
    }
  }, [selectedActor]);

  useEffect(() => {
    onHoverActorChange?.(hoveredActorId);
  }, [hoveredActorId, onHoverActorChange]);

  useEffect(() => {
    if (!selectedActorId || !activeCardId) return;

    setLastTooltipSelection((current) => (
      current?.actorId === selectedActorId && current?.cardId === activeCardId
        ? current
        : { actorId: selectedActorId, cardId: activeCardId }
    ));
  }, [activeCardId, selectedActorId]);

  useEffect(() => {
    if (!tooltipCard) {
      setFloatingTooltipStyle(null);
      return undefined;
    }

    const updateFloatingTooltip = () => {
      setFloatingTooltipStyle(getFloatingTooltipStyle(uiScale));
    };

    updateFloatingTooltip();
    window.addEventListener('resize', updateFloatingTooltip);

    return () => {
      window.removeEventListener('resize', updateFloatingTooltip);
    };
  }, [layerSize.height, layerSize.width, tooltipCard, uiScale]);

  useEffect(() => {
    if (!pendingDragState && !dragState) return undefined;

    const handlePointerMove = (event) => {
      const rect = layerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const pointer = {
        x: clamp(event.clientX - rect.left, 0, rect.width),
        y: clamp(event.clientY - rect.top, 0, rect.height),
      };

      const targetElement = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-battle-target-id]');
      const hoveredTargetId = targetElement?.dataset?.battleTargetId;

      if (pendingDragState) {
        const distance = Math.hypot(
          event.clientX - pendingDragState.startClient.x,
          event.clientY - pendingDragState.startClient.y,
        );

        if (distance < 10) {
          return;
        }

        const nextOrigin = getActorAnchor(
          pendingDragState.actorId,
          spriteByActorId,
          viewport,
          scene,
          layerSize,
          {
            verticalOffsetFactor: 0.18,
            xPadding: 12,
            minY: 12,
            maxY: rect.height - 12,
          },
        ) || pendingDragState.pointer;

        setDragState({
          actorId: pendingDragState.actorId,
          cardId: pendingDragState.cardId,
          origin: nextOrigin,
          pointer,
              hoveredTargetId: targetableSet.has(hoveredTargetId) ? hoveredTargetId : null,
        });
        setPendingDragState(null);
        return;
      }

      const currentOrigin = getActorAnchor(dragState.actorId, spriteByActorId, viewport, scene, layerSize, {
        verticalOffsetFactor: 0.18,
        xPadding: 12,
        minY: 12,
        maxY: rect.height - 12,
      });

      dragQueuedRef.current = {
        origin: currentOrigin || dragState.origin,
        pointer,
        hoveredTargetId: targetableSet.has(hoveredTargetId) ? hoveredTargetId : null,
      };

      if (dragFrameRef.current) return;

      dragFrameRef.current = window.requestAnimationFrame(() => {
        const queuedDrag = dragQueuedRef.current;
        dragQueuedRef.current = null;
        dragFrameRef.current = 0;

        if (!queuedDrag) return;

        setDragState((current) => current ? {
          ...current,
          origin: queuedDrag.origin,
          pointer: queuedDrag.pointer,
          hoveredTargetId: queuedDrag.hoveredTargetId,
        } : null);
      });
    };

    const handlePointerUp = () => {
      setPendingDragState(null);
      if (dragState?.hoveredTargetId && activeCard) {
        onExecuteAction(dragState.actorId, dragState.hoveredTargetId, activeCard);
        setDragState(null);
        setLastTooltipSelection(null);
        setPassiveHoveredActorId(null);
        onCancelSelection();
        return;
      }

      setDragState(null);
      setPassiveHoveredActorId(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });

    return () => {
      if (dragFrameRef.current) {
        window.cancelAnimationFrame(dragFrameRef.current);
        dragFrameRef.current = 0;
      }
      dragQueuedRef.current = null;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [activeCard, dragState, layerSize, onCancelSelection, onExecuteAction, pendingDragState, scene, spriteByActorId, targetableSet, viewport]);

  const handleCancelSelection = () => {
    setPendingDragState(null);
    setDragState(null);
    setLastTooltipSelection(null);
    setPassiveHoveredActorId(null);
    onCancelSelection();
  };

  const startImmediateDrag = (event, initialHoveredTargetId = null) => {
    if (!activeCard || !selectedActorId || dragState || pendingDragState) return;

    const rect = layerRef.current?.getBoundingClientRect();
    if (!rect) return;

    event.preventDefault();
    setPassiveHoveredActorId(null);
    suppressHitboxClickUntilRef.current = performance.now() + 400;

    const pointer = {
      x: clamp(event.clientX - rect.left, 0, rect.width),
      y: clamp(event.clientY - rect.top, 0, rect.height),
    };
    const origin = getActorAnchor(selectedActorId, spriteByActorId, viewport, scene, layerSize, {
      verticalOffsetFactor: 0.18,
      xPadding: 12,
      minY: 12,
      maxY: rect.height - 12,
    }) || pointer;

    setDragState({
      actorId: selectedActorId,
      cardId: activeCard.id,
      origin,
      pointer,
      hoveredTargetId: targetableSet.has(initialHoveredTargetId) ? initialHoveredTargetId : null,
    });
  };

  const performActionAndClose = (actorId, targetId, card) => {
    if (!actorId || !targetId || !card) return;

    onExecuteAction(actorId, targetId, card);
    setPendingDragState(null);
    setDragState(null);
    setLastTooltipSelection(null);
    setPassiveHoveredActorId(null);
    onCancelSelection();
  };

  const performUnmaskAndClose = (targetId) => {
    if (!targetId || !unmaskTargetSet.has(targetId)) return;

    onExecuteUnmask?.(targetId);
    setPendingDragState(null);
    setDragState(null);
    setLastTooltipSelection(null);
    setPassiveHoveredActorId(null);
    onCancelSelection();
  };

  const handleScenePointerDown = (event) => {
    startImmediateDrag(event, null);
  };

  const handleHitboxPointerDown = (event, spriteCharId) => {
    if (!activeCard || !selectedActorId) return;
    startImmediateDrag(event, spriteCharId);
  };

  const handleCardPointerDown = (card, event) => {
    if (card.blockedReason || !selectedActorId) return;

    const rect = layerRef.current?.getBoundingClientRect();
    if (!rect) return;

    onArmCard(card.id);
    event.preventDefault();
    setPassiveHoveredActorId(null);

    const pointer = {
      x: clamp(event.clientX - rect.left, 0, rect.width),
      y: clamp(event.clientY - rect.top, 0, rect.height),
    };
    const origin = getActorAnchor(selectedActorId, spriteByActorId, viewport, scene, layerSize, {
      verticalOffsetFactor: 0.18,
      xPadding: 12,
      minY: 12,
      maxY: rect.height - 12,
    }) || pointer;

    setLastTooltipSelection({
      actorId: selectedActorId,
      cardId: card.id,
    });

    setPendingDragState({
      actorId: selectedActorId,
      cardId: card.id,
      startClient: {
        x: event.clientX,
        y: event.clientY,
      },
      origin,
      pointer,
    });
  };

  const currentTargetCenter = dragState?.hoveredTargetId
    ? getActorAnchor(dragState.hoveredTargetId, spriteByActorId, viewport, scene, layerSize, {
      verticalOffsetFactor: 0.12,
      xPadding: 12,
      minY: 12,
      maxY: layerSize.height - 12,
    })
    : null;

  const selectedActorAnchor = selectedActorId
    ? getActorScreenAnchor(
      selectedActorId,
      spriteByActorId,
      viewport,
      scene,
      layerRef.current?.getBoundingClientRect(),
      actorPanelSize,
      uiScale,
    )
    : null;
  const selectedActorPanel = (
    <SelectedActorPanel
      anchor={selectedActorAnchor}
      actorName={selectedActor?.stats?.name}
      actionCards={actionCards}
      activeCardId={activeCardId}
      onCardPointerDown={handleCardPointerDown}
      onCancelSelection={handleCancelSelection}
      onPanelSizeChange={handleActorPanelSizeChange}
      uiScale={uiScale}
      floating
      hidden={Boolean(dragState)}
    />
  );

  return (
    <div ref={layerRef} className="battle-test__interaction">
      <ArrowLayer layerSize={layerSize} dragState={dragState} targetCenter={currentTargetCenter} />

      {tooltipCard && floatingTooltipStyle && typeof document !== 'undefined'
        ? createPortal(
          <div className="battle-test__floating-tooltip" style={floatingTooltipStyle}>
            <DetailTooltip card={tooltipCard} target={tooltipTarget} />
          </div>,
          document.body,
        )
        : null}

      {activeCard ? (
        <div
          className="battle-test__drag-surface"
          onPointerDown={handleScenePointerDown}
        />
      ) : null}

      {sprites.map((sprite) => {
        const hitWidth = sprite.drawHeight * 0.78;
        const hitHeight = sprite.drawHeight * 0.92;
        const isSelectable = selectableSet.has(sprite.charId);
        const isTargetable = targetableSet.has(sprite.charId);
        const isUnmaskTarget = unmaskTargetSet.has(sprite.charId);

        return (
          <button
            key={`${sprite.id}:hitbox`}
            type="button"
            data-battle-target-id={sprite.charId}
            disabled={!isSelectable && !isTargetable && !isUnmaskTarget}
            className="battle-test__char-hitbox"
            onPointerDown={(event) => {
              handleHitboxPointerDown(event, sprite.charId);
            }}
            onClick={() => {
              if (performance.now() < suppressHitboxClickUntilRef.current) return;
              if (dragState || pendingDragState) return;
              if (activeCard && selectedActorId && isTargetable) {
                performActionAndClose(selectedActorId, sprite.charId, activeCard);
                return;
              }
              if (!activeCard && isUnmaskTarget) {
                performUnmaskAndClose(sprite.charId);
                return;
              }
              if (isSelectable) onSelectActor(sprite.charId);
            }}
            onPointerEnter={() => {
              if (!dragState && (isSelectable || isTargetable || isUnmaskTarget)) {
                setPassiveHoveredActorId(sprite.charId);
              }
            }}
            onPointerLeave={() => {
              setPassiveHoveredActorId((current) => (
                current === sprite.charId ? null : current
              ));
            }}
            style={{
              left: `${(
                viewport.left + ((sprite.centerX - hitWidth / 2) / scene.width) * viewport.width
              ) * 100}%`,
              top: `${(
                viewport.top + ((sprite.centerY - hitHeight / 2) / scene.height) * viewport.height
              ) * 100}%`,
              width: `${((hitWidth / scene.width) * viewport.width) * 100}%`,
              height: `${((hitHeight / scene.height) * viewport.height) * 100}%`,
            }}
            aria-label={sprite.label}
          />
        );
      })}

      {typeof document !== 'undefined'
        ? createPortal(selectedActorPanel, document.body)
        : selectedActorPanel}
    </div>
  );
}
