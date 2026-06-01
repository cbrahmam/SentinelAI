import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as d3 from 'd3'

const STATUS_COLORS = {
  healthy: '#10B981',
  warning: '#F59E0B',
  critical: '#EF4444',
  unknown: '#6B7280',
}

export default function ServiceMap() {
  const svgRef = useRef(null)
  const containerRef = useRef(null)
  const navigate = useNavigate()
  const [mapData, setMapData] = useState(null)
  const [tooltip, setTooltip] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/services/service-map')
        const data = await res.json()
        setMapData(data)
      } catch (e) {
        console.error('Service map fetch error:', e)
      }
    }
    load()
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!mapData || !svgRef.current || !containerRef.current) return

    const container = containerRef.current
    const width = container.clientWidth
    const height = Math.max(500, container.clientHeight)

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svg.attr('width', width).attr('height', height)

    const defs = svg.append('defs')
    defs.append('marker')
      .attr('id', 'arrow-healthy')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 28)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#374151')

    defs.append('marker')
      .attr('id', 'arrow-error')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 28)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#EF4444')

    const g = svg.append('g')

    const zoom = d3.zoom()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => g.attr('transform', event.transform))
    svg.call(zoom)

    const nodes = mapData.nodes.map(d => ({ ...d }))
    const links = mapData.edges.map(d => ({ ...d }))

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(160))
      .force('charge', d3.forceManyBody().strength(-600))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(50))

    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', d => d.healthy ? '#374151' : '#EF4444')
      .attr('stroke-width', d => Math.max(1.5, Math.min(4, (d.traffic || 0) / 100)))
      .attr('stroke-opacity', 0.6)
      .attr('marker-end', d => d.healthy ? 'url(#arrow-healthy)' : 'url(#arrow-error)')

    const node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .call(d3.drag()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart()
          d.fx = d.x; d.fy = d.y
        })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0)
          d.fx = null; d.fy = null
        })
      )

    node.append('rect')
      .attr('width', 140)
      .attr('height', 50)
      .attr('x', -70)
      .attr('y', -25)
      .attr('rx', 8)
      .attr('fill', '#1F2937')
      .attr('stroke', d => STATUS_COLORS[d.status] || STATUS_COLORS.unknown)
      .attr('stroke-width', 2)
      .attr('cursor', 'pointer')

    node.each(function (d) {
      if (d.has_alert) {
        d3.select(this).append('rect')
          .attr('width', 144)
          .attr('height', 54)
          .attr('x', -72)
          .attr('y', -27)
          .attr('rx', 10)
          .attr('fill', 'none')
          .attr('stroke', '#EF4444')
          .attr('stroke-width', 1)
          .attr('stroke-opacity', 0.5)
          .attr('class', 'pulse-ring')
      }
    })

    node.append('circle')
      .attr('r', 4)
      .attr('cx', 55)
      .attr('cy', -15)
      .attr('fill', d => STATUS_COLORS[d.status] || STATUS_COLORS.unknown)

    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', -3)
      .attr('fill', '#E5E7EB')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .text(d => d.id)

    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', 14)
      .attr('fill', '#9CA3AF')
      .attr('font-size', '9px')
      .text(d => {
        const m = d.metrics || {}
        const cpu = m.cpu_usage != null ? `CPU:${m.cpu_usage.toFixed(0)}%` : ''
        const err = m.error_rate != null ? `Err:${m.error_rate.toFixed(1)}` : ''
        return [cpu, err].filter(Boolean).join(' | ')
      })

    node.on('click', (event, d) => {
      navigate(`/services/${d.id}`)
    })

    node.on('mouseenter', (event, d) => {
      const m = d.metrics || {}
      setTooltip({
        x: event.pageX,
        y: event.pageY,
        name: d.id,
        status: d.status,
        cpu: m.cpu_usage,
        mem: m.memory_usage,
        err: m.error_rate,
        rps: m.request_rate,
        p95: m.p95_latency_ms,
      })
    })

    node.on('mouseleave', () => setTooltip(null))

    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y)
      node.attr('transform', d => `translate(${d.x},${d.y})`)
    })

    return () => simulation.stop()
  }, [mapData, navigate])

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white">Service Dependency Map</h2>
      <div ref={containerRef} className="bg-[#111827] border border-gray-700/50 rounded-lg relative" style={{ height: '600px' }}>
        {!mapData ? (
          <div className="flex items-center justify-center h-full text-gray-400">Loading service map...</div>
        ) : (
          <svg ref={svgRef} className="w-full h-full" />
        )}
        {tooltip && (
          <div
            className="fixed z-50 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 shadow-xl pointer-events-none"
            style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-white">{tooltip.name}</span>
              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                tooltip.status === 'healthy' ? 'bg-emerald-500/20 text-emerald-400' :
                tooltip.status === 'warning' ? 'bg-amber-500/20 text-amber-400' :
                tooltip.status === 'critical' ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'
              }`}>{tooltip.status}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
              {tooltip.cpu != null && <span className="text-gray-400">CPU: <span className="text-gray-200">{tooltip.cpu.toFixed(1)}%</span></span>}
              {tooltip.mem != null && <span className="text-gray-400">Mem: <span className="text-gray-200">{tooltip.mem.toFixed(1)}%</span></span>}
              {tooltip.err != null && <span className="text-gray-400">Errors: <span className="text-gray-200">{tooltip.err.toFixed(1)}/s</span></span>}
              {tooltip.rps != null && <span className="text-gray-400">RPS: <span className="text-gray-200">{tooltip.rps.toFixed(0)}</span></span>}
              {tooltip.p95 != null && <span className="text-gray-400">P95: <span className="text-gray-200">{tooltip.p95.toFixed(0)}ms</span></span>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
