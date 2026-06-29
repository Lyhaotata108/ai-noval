/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { 
  Users, 
  Plus, 
  Trash2, 
  Edit, 
  Sliders, 
  HelpCircle, 
  Sparkles, 
  RefreshCw, 
  MousePointer, 
  Settings, 
  TrendingUp, 
  AlertCircle,
  Activity,
  Heart,
  Flame,
  Info,
  ChevronRight,
  Maximize2
} from 'lucide-react';
import { Character, ProjectData } from '../types';

interface RelationshipGraphProps {
  projectData: ProjectData;
  onUpdateCharacters: (updatedCharacters: Character[]) => void;
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  role: 'protagonist' | 'antagonist' | 'supporting';
  gender: string;
  age: string;
  character: Character;
}

interface GraphLink {
  id: string;
  sourceId: string;
  targetId: string;
  sourceName: string;
  targetName: string;
  source: GraphNode | string;
  target: GraphNode | string;
  relationText: string;
  connection: number;
  conflict: number;
}

// Parse structured relation string like: "(关联:85, 冲突:95) 宿命之战，誓不两立"
function parseRelationship(descStr: string = '') {
  const match = descStr.match(/^\(关联:(\d+),\s*冲突:(\d+)\)\s*(.*)$/);
  if (match) {
    return {
      connection: Math.max(0, Math.min(100, parseInt(match[1]) || 0)),
      conflict: Math.max(0, Math.min(100, parseInt(match[2]) || 0)),
      description: match[3] || '暂无详细描述'
    };
  }

  // Fallback smart parser
  const cleanDesc = descStr.trim();
  let conflict = 10;
  let connection = 45;

  const text = cleanDesc.toLowerCase();

  // Keyword scanners for conflict
  if (/宿仇|死敌|杀|仇|不死不休|逆袭|叛|反目|对立|敌视|决裂|死对头|决战/.test(text)) {
    conflict = 90;
  } else if (/敌抗|敌退|冲突|交手|击败|暗算|窥伺|伺机|暗中下毒|陷害|觊觎|针对/.test(text)) {
    conflict = 75;
  } else if (/竞争|不和|猜忌|警惕|防备|戒备|嫌隙|摩擦|分歧|不和睦/.test(text)) {
    conflict = 50;
  } else if (/深爱|莫逆|挚友|同盟|生死之交|暧昧|情侣|救赎|扶持|联手|伙伴/.test(text)) {
    conflict = 5;
  }

  // Keyword scanners for connection
  if (/深爱|爱慕|情侣|白头|绝密|生死之交|极度信任|莫逆|护道|契约|师徒|手足|生死|同生共死|结发|执子之手/.test(text)) {
    connection = 90;
  } else if (/信任|友情|盟友|同盟|相助|指点|提携|友好|搭档|挚友|暗中保护|守护/.test(text)) {
    connection = 70;
  } else if (/世交|同门|同族|认识|结识|相识|宗门|长老|堂主|弟子/.test(text)) {
    connection = 45;
  } else if (/萍水相逢|路人|警惕|敌对|对决|对立/.test(text)) {
    connection = 20;
  }

  return {
    connection,
    conflict,
    description: cleanDesc || '暂无关系说明'
  };
}

function serializeRelationship(connection: number, conflict: number, description: string) {
  const cleanDesc = description.replace(/^\(关联:\d+,\s*冲突:\d+\)\s*/, '');
  return `(关联:${connection}, 冲突:${conflict}) ${cleanDesc}`;
}

export default function RelationshipGraph({ projectData, onUpdateCharacters }: RelationshipGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  
  // Dimensions
  const [dimensions, setDimensions] = useState({ width: 600, height: 450 });
  
  // Selected visual element in graph/UI
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedLink, setSelectedLink] = useState<GraphLink | null>(null);
  
  // Navigation for active sub-view in panel
  const [panelTab, setPanelTab] = useState<'info' | 'editor' | 'help'>('info');
  
  // Editor form state
  const [formSourceId, setFormSourceId] = useState('');
  const [formTargetId, setFormTargetId] = useState('');
  const [formRelationText, setFormRelationText] = useState('');
  const [formConnection, setFormConnection] = useState(50);
  const [formConflict, setFormConflict] = useState(10);
  
  // Local list of active nodes & links
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; links: GraphLink[] }>({ nodes: [], links: [] });

  // 1. Observe container resize for Canvas resizing as per Guidelines
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Set initial size
    setDimensions({
      width: containerRef.current.clientWidth || 600,
      height: Math.max(450, containerRef.current.clientHeight || 450)
    });

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      setDimensions({
        width: Math.max(400, width),
        height: Math.max(450, height)
      });
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // 2. Build or restructure nodes & links array based on character relationships
  useEffect(() => {
    const characters = projectData.characters;
    if (!characters || characters.length === 0) {
      setGraphData({ nodes: [], links: [] });
      setSelectedNode(null);
      setSelectedLink(null);
      return;
    }

    // Map characters to graph nodes
    const nodes: GraphNode[] = characters.map((c) => ({
      id: c.id,
      name: c.name,
      role: c.role,
      gender: c.gender,
      age: c.age,
      character: c,
    }));

    // Derive links
    const nameToId = new Map<string, string>();
    characters.forEach(c => nameToId.set(c.name, c.id));

    const linksMap = new Map<string, GraphLink>();

    characters.forEach((charSource) => {
      const sourceId = charSource.id;
      if (!charSource.relationships) return;

      Object.entries(charSource.relationships).forEach(([targetName, relString]) => {
        const targetId = nameToId.get(targetName);
        if (!targetId || targetId === sourceId) return; // Ignore self-relations or non-existent

        // Create unique undirected edge key: sorted ids
        const edgeId = [sourceId, targetId].sort().join('->');
        const parsed = parseRelationship(relString);

        if (!linksMap.has(edgeId)) {
          linksMap.set(edgeId, {
            id: edgeId,
            sourceId: sourceId,
            targetId: targetId,
            sourceName: charSource.name,
            targetName: targetName,
            source: sourceId, // initially IDs, D3 will replace with nodes
            target: targetId,
            relationText: parsed.description,
            connection: parsed.connection,
            conflict: parsed.conflict
          });
        } else {
          // If both have relationship defined, merge beautifully
          const existing = linksMap.get(edgeId)!;
          // Average connection & conflict, combine descriptions
          const combinedDesc = existing.relationText === parsed.description 
            ? existing.relationText 
            : `${existing.sourceName}视角: ${existing.relationText} / ${charSource.name}视角: ${parsed.description}`;
          
          linksMap.set(edgeId, {
            ...existing,
            connection: Math.round((existing.connection + parsed.connection) / 2),
            conflict: Math.round((existing.conflict + parsed.conflict) / 2),
            relationText: combinedDesc
          });
        }
      });
    });

    const links = Array.from(linksMap.values());
    setGraphData({ nodes, links });

    // Sync form selectors
    if (characters.length >= 2) {
      if (!formSourceId || !characters.find(c => c.id === formSourceId)) {
        setFormSourceId(characters[0].id);
      }
      if (!formTargetId || !characters.find(c => c.id === formTargetId) || formTargetId === formSourceId) {
        setFormTargetId(characters[1].id);
      }
    }
  }, [projectData.characters]);

  // Keep selected element updated with new prop data
  useEffect(() => {
    if (selectedNode) {
      const updated = graphData.nodes.find(n => n.id === selectedNode.id);
      if (updated) {
        setSelectedNode(updated);
      } else {
        setSelectedNode(null);
      }
    }
    if (selectedLink) {
      const updated = graphData.links.find(l => l.id === selectedLink.id);
      if (updated) {
        setSelectedLink(updated);
      } else {
        setSelectedLink(null);
      }
    }
  }, [graphData]);

  // Handle form quick-populate based on source/target switches
  useEffect(() => {
    if (formSourceId && formTargetId) {
      const sourceChar = projectData.characters.find(c => c.id === formSourceId);
      const targetChar = projectData.characters.find(c => c.id === formTargetId);
      
      if (sourceChar && targetChar) {
        const key = targetChar.name;
        const rawRelation = sourceChar.relationships && sourceChar.relationships[key];
        if (rawRelation) {
          const parsed = parseRelationship(rawRelation);
          setFormRelationText(parsed.description);
          setFormConnection(parsed.connection);
          setFormConflict(parsed.conflict);
        } else {
          // Check reverse
          const reverseKey = sourceChar.name;
          const rawReverse = targetChar.relationships && targetChar.relationships[reverseKey];
          if (rawReverse) {
            const parsed = parseRelationship(rawReverse);
            setFormRelationText(parsed.description);
            setFormConnection(parsed.connection);
            setFormConflict(parsed.conflict);
          } else {
            setFormRelationText('');
            setFormConnection(45);
            setFormConflict(10);
          }
        }
      }
    }
  }, [formSourceId, formTargetId, projectData.characters]);

  // 3. Render D3 Force Simulation inside SVG
  useEffect(() => {
    if (!svgRef.current || graphData.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    // Clear previous renders
    svg.selectAll('*').remove();

    const width = dimensions.width;
    const height = dimensions.height;

    // Create a zoom container group
    const g = svg.append('g').attr('class', 'zoom-container');

    // Setup zoom behaviors
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Copy arrays to avoid mutating state directly in D3 simulation
    const simNodes: GraphNode[] = graphData.nodes.map(n => ({ ...n }));
    const simLinks = graphData.links.map(l => {
      // Find actual nodes in simNodes referring to original ids
      const sourceNode = simNodes.find(n => n.id === l.sourceId);
      const targetNode = simNodes.find(n => n.id === l.targetId);
      return {
        ...l,
        source: sourceNode || l.sourceId,
        target: targetNode || l.targetId
      };
    }) as any[];

    // D3 Forces
    const simulation = d3.forceSimulation<GraphNode>(simNodes)
      .force('link', d3.forceLink<GraphNode, any>(simLinks)
        .id(d => d.id)
        .distance((d) => {
          // Dynamic distance depending on connection index: closer if highly connected
          return 250 - (d.connection * 1.5);
        }))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius(60))
      .alphaDecay(0.04);

    // Render patterns for arrows if we had directed links, but we use animated dashes and gorgeous nodes
    // Let's define filters/glow effects inside SVG defs
    const defs = svg.append('defs');
    
    // Glowing shadow filters for protagonist node
    const goldGlow = defs.append('filter')
      .attr('id', 'glow-protagonist')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');
    goldGlow.append('feGaussianBlur').attr('stdDeviation', '6').attr('result', 'blur');
    goldGlow.append('feComponentTransfer').append('feFuncA').attr('type', 'linear').attr('slope', '0.6');
    const mergeGold = goldGlow.append('feMerge');
    mergeGold.append('feMergeNode').attr('in', 'blur');
    mergeGold.append('feMergeNode').attr('in', 'SourceGraphic');

    // Rose glow for antagonist target
    const roseGlow = defs.append('filter')
      .attr('id', 'glow-antagonist')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');
    roseGlow.append('feGaussianBlur').attr('stdDeviation', '6').attr('result', 'blur');
    roseGlow.append('feComponentTransfer').append('feFuncA').attr('type', 'linear').attr('slope', '0.6');
    const mergeRose = roseGlow.append('feMerge');
    mergeRose.append('feMergeNode').attr('in', 'blur');
    mergeRose.append('feMergeNode').attr('in', 'SourceGraphic');

    // DRAW LINKS
    const linkGroup = g.append('g').attr('class', 'links');
    
    const linkElements = linkGroup.selectAll('.link-group')
      .data(simLinks)
      .enter()
      .append('g')
      .attr('class', 'link-group')
      .style('cursor', 'pointer');

    // Draw the background invisible thicker hit-target for links to pick clicking easily
    linkElements.append('line')
      .attr('class', 'link-hit-target')
      .attr('stroke', 'transparent')
      .attr('stroke-width', 15);

    // Draw visible relationship link line
    const linkLines = linkElements.append('line')
      .attr('class', 'relationship-line')
      .attr('stroke', (d) => {
        // Highlight active link
        if (selectedLinkIdMatches(d)) return '#d97706'; // gold highlighted
        // Color based on conflict
        if (d.conflict >= 65) return '#f43f5e'; // aggressive rose crimson
        if (d.conflict >= 40) return '#f97316'; // warning orange
        if (d.connection >= 60) return '#10b981'; // cozy emerald green
        return '#64748b'; // generic slate
      })
      .attr('stroke-width', (d) => {
        const isSelected = selectedLinkIdMatches(d);
        // Thickness proportional to relationship connection
        const baseWidth = 1.5 + (d.connection / 30);
        return isSelected ? baseWidth + 2.5 : baseWidth;
      })
      .attr('opacity', (d) => {
        if (selectedNode) {
          // Dim non-connected links
          const isConnected = d.source.id === selectedNode.id || d.target.id === selectedNode.id;
          return isConnected ? 1 : 0.15;
        }
        if (selectedLink) {
          return selectedLinkIdMatches(d) ? 1 : 0.2;
        }
        return 0.75;
      })
      .attr('stroke-dasharray', (d) => {
        // High conflict exhibits dashed tension lines
        if (d.conflict >= 50) return '6, 4';
        return 'none';
      });

    // Add CSS animation keyframes dynamically to make high-conflict link dashes slide, portraying live tension!
    svg.append('style').text(`
      @keyframes dash-tension {
        to {
          stroke-dashoffset: -20;
        }
      }
      .link-tension-animate {
        animation: dash-tension 0.6s linear infinite;
      }
    `);

    // Apply sliding dashboard animation on high strain lines
    linkLines.each(function(d) {
      if (d.conflict >= 50) {
        d3.select(this).classed('link-tension-animate', true);
      }
    });

    // Draw text labels alongside links on hovered or high intensity
    const linkTextsGroup = g.append('g').attr('class', 'link-labels');
    const linkTexts = linkTextsGroup.selectAll('.link-label')
      .data(simLinks)
      .enter()
      .append('g')
      .attr('class', 'link-label')
      .attr('opacity', (d) => {
        if (selectedNode) {
          const isConnected = d.source.id === selectedNode.id || d.target.id === selectedNode.id;
          return isConnected ? 0.9 : 0.05;
        }
        if (selectedLink) {
          return selectedLinkIdMatches(d) ? 0.9 : 0.1;
        }
        return 0.45; // slightly subtler default
      })
      .style('pointer-events', 'none');

    // Background white/glass pills for texts
    linkTexts.append('rect')
      .attr('rx', 4)
      .attr('ry', 4)
      .attr('fill', '#020617')
      .attr('stroke', '#334155')
      .attr('stroke-width', 0.5)
      .attr('height', 16)
      .attr('width', (d) => Math.min(100, Math.max(48, d.relationText.length * 10 + 10)))
      .attr('y', -8);

    linkTexts.append('text')
      .attr('fill', '#cbd5e1')
      .attr('text-anchor', 'middle')
      .attr('font-size', '9px')
      .attr('y', 3)
      .text((d) => {
        // Truncate long relation view strings
        if (d.relationText.length > 8) {
          return d.relationText.substring(0, 8) + '...';
        }
        return d.relationText;
      });

    // Click link handler
    linkElements.on('click', (event, d) => {
      event.stopPropagation();
      // Find the corresponding structured edge record
      const foundLink = graphData.links.find(l => l.id === d.id);
      if (foundLink) {
        setSelectedLink(foundLink);
        setSelectedNode(null);
        setPanelTab('info');
      }
    });


    // DRAW NODES
    const nodeGroup = g.append('g').attr('class', 'nodes');

    const nodeElements = nodeGroup.selectAll('.node')
      .data(simNodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .call(d3.drag<SVGGElement, GraphNode>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended)
      );

    // Background selection ring indicator
    nodeElements.append('circle')
      .attr('class', 'selection-ring')
      .attr('r', (d) => getRadius(d.role) + 7)
      .attr('fill', 'transparent')
      .attr('stroke', '#f59e0b')
      .attr('stroke-width', 2)
      .style('display', (d) => selectedNode && selectedNode.id === d.id ? 'block' : 'none');

    // Node visible core circles
    nodeElements.append('circle')
      .attr('class', 'node-circle')
      .attr('r', (d) => getRadius(d.role))
      .attr('fill', (d) => {
        if (d.role === 'protagonist') return '#f59e0b'; // Amber Gold
        if (d.role === 'antagonist') return '#ef4444'; // Red Crimson
        return '#0ea5e9'; // Cool blue supporting
      })
      .attr('filter', (d) => {
        if (d.role === 'protagonist') return 'url(#glow-protagonist)';
        if (d.role === 'antagonist') return 'url(#glow-antagonist)';
        return 'none';
      })
      .attr('stroke', '#0f172a')
      .attr('stroke-width', 2.5)
      .attr('opacity', (d) => {
        if (selectedNode) {
          const isCurrent = d.id === selectedNode.id;
          const isNeighbour = graphData.links.some(
            l => (l.sourceId === selectedNode.id && l.targetId === d.id) || 
                 (l.targetId === selectedNode.id && l.sourceId === d.id)
          );
          return isCurrent || isNeighbour ? 1 : 0.25;
        }
        if (selectedLink) {
          const partOfLink = selectedLink.sourceId === d.id || selectedLink.targetId === d.id;
          return partOfLink ? 1 : 0.25;
        }
        return 1;
      });

    // Custom badges or text indicators for "role description types" inside circle
    nodeElements.append('text')
      .attr('text-anchor', 'middle')
      .attr('alignment-baseline', 'middle')
      .attr('fill', '#020617')
      .attr('font-weight', 'bold')
      .attr('font-size', '10px')
      .text((d) => {
        if (d.role === 'protagonist') return '主';
        if (d.role === 'antagonist') return '敌';
        return '配';
      })
      .attr('opacity', (d) => {
        if (selectedNode) {
          const isCurrent = d.id === selectedNode.id;
          const isNeighbour = graphData.links.some(
            l => (l.sourceId === selectedNode.id && l.targetId === d.id) || 
                 (l.targetId === selectedNode.id && l.sourceId === d.id)
          );
          return isCurrent || isNeighbour ? 1 : 0.25;
        }
        if (selectedLink) {
          return selectedLink.sourceId === d.id || selectedLink.targetId === d.id ? 1 : 0.25;
        }
        return 0.9;
      });

    // Double glow ring pulse for protagonist
    nodeElements.filter(d => d.role === 'protagonist')
      .append('circle')
      .attr('r', getRadius('protagonist') + 4)
      .attr('fill', 'none')
      .attr('stroke', '#fbbf24')
      .attr('stroke-width', 1)
      .attr('opacity', 0.4)
      .style('animation', 'pulse 2s infinite');

    // Outer Text details (Character names)
    nodeElements.append('text')
      .attr('dy', (d) => getRadius(d.role) + 16)
      .attr('text-anchor', 'middle')
      .attr('fill', '#f1f5f9')
      .style('font-weight', (d) => d.role === 'protagonist' ? 'bold' : 'normal')
      .style('font-size', '11px')
      .style('text-shadow', '0 2px 4px rgba(0,0,0,0.8)')
      .text((d) => d.name)
      .attr('opacity', (d) => {
        if (selectedNode) {
          const isCurrent = d.id === selectedNode.id;
          const isNeighbour = graphData.links.some(
            l => (l.sourceId === selectedNode.id && l.targetId === d.id) || 
                 (l.targetId === selectedNode.id && l.sourceId === d.id)
          );
          return isCurrent || isNeighbour ? 1 : 0.3;
        }
        if (selectedLink) {
          return selectedLink.sourceId === d.id || selectedLink.targetId === d.id ? 1 : 0.3;
        }
        return 0.95;
      });

    // Hover tooltip/enlarging effect
    nodeElements.on('mouseenter', function(event, d) {
      d3.select(this).select('.node-circle')
        .transition().duration(150)
        .attr('r', getRadius(d.role) + 4);
    }).on('mouseleave', function(event, d) {
      d3.select(this).select('.node-circle')
        .transition().duration(150)
        .attr('r', getRadius(d.role));
    });

    // Click handler for nodes
    nodeElements.on('click', (event, d) => {
      event.stopPropagation();
      const originalNode = graphData.nodes.find(n => n.id === d.id);
      if (originalNode) {
        setSelectedNode(originalNode);
        setSelectedLink(null);
        setPanelTab('info');
      }
    });

    // Click canvas background to clean up highlights
    svg.on('click', () => {
      setSelectedNode(null);
      setSelectedLink(null);
    });

    // SIMULATION TICK HANDLER
    simulation.on('tick', () => {
      // Direct linkages line bounds
      linkLines
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      // Thicker click bounds
      linkElements.selectAll('.link-hit-target')
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      // Link badges centered on center line offset
      linkTextsGroup.selectAll('.link-label')
        .attr('transform', (d: any) => {
          const x = (d.source.x + d.target.x) / 2;
          const y = (d.source.y + d.target.y) / 2;
          // Calculate width dynamically
          const textW = Math.min(100, Math.max(48, d.relationText.length * 10 + 10));
          return `translate(${x - textW / 2}, ${y})`;
        });

      // Update positions for nodes
      nodeElements.attr('transform', (d: any) => `translate(${d.x}, ${d.y})`);
    });

    // HELPER FUNCTIONS FOR RENDERING
    function getRadius(role: string) {
      if (role === 'protagonist') return 24;
      if (role === 'antagonist') return 18;
      return 15;
    }

    function selectedLinkIdMatches(d: any) {
      if (!selectedLink) return false;
      return d.id === selectedLink.id;
    }

    // Drag handlers
    function dragstarted(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: any) {
      d.fx = event.x;
      d.fy = event.y;
    }

    // Keep floating position fixed to avoid flying, but let user lock them
    function dragended(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    // Automatically zoom fit to view on load
    setTimeout(() => {
      // Simple automated bounding center scale fit
      const bounds = g.node()?.getBBox();
      if (bounds && bounds.width > 0 && bounds.height > 0) {
        const dx = bounds.width;
        const dy = bounds.height;
        const cx = bounds.x + dx / 2;
        const cy = bounds.y + dy / 2;
        const scale = 0.85 / Math.max(dx / width, dy / height);
        const translate = [width / 2 - scale * cx, height / 2 - scale * cy];
        
        svg.transition().duration(600).call(
          zoom.transform,
          d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
        );
      }
    }, 150);

    return () => {
      simulation.stop();
    };
  }, [graphData, dimensions, selectedNode, selectedLink]);

  // Reset graph layout
  const resetZoom = () => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    
    // Zoom behavior reset
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        svg.select('.zoom-container').attr('transform', event.transform);
      });
      
    svg.transition().duration(400).call(
      zoom.transform,
      d3.zoomIdentity.translate(0, 0).scale(1)
    );
  };

  // 4. Save/Update Relationship to Local Characters collection
  const handleSaveRelationship = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSourceId || !formTargetId) return;
    if (formSourceId === formTargetId) {
      alert('无法为角色自身建立关系，请选择不同的角色配对。');
      return;
    }

    const { characters } = projectData;
    const sourceChar = characters.find(c => c.id === formSourceId);
    const targetChar = characters.find(c => c.id === formTargetId);

    if (!sourceChar || !targetChar) return;

    // Create relation descriptor serialized text
    const serialized = serializeRelationship(formConnection, formConflict, formRelationText || '有恩怨来往');

    // Update characters in list
    const updatedCharacters = characters.map((c) => {
      if (c.id === sourceChar.id) {
        return {
          ...c,
          relationships: {
            ...(c.relationships || {}),
            [targetChar.name]: serialized
          }
        };
      }
      return c;
    });

    onUpdateCharacters(updatedCharacters);
    
    // Switch to info panel to show the link
    setSelectedLink(null);
    setPanelTab('info');
    alert(`✨ 成功构筑并同步 [${sourceChar.name}] 到 [${targetChar.name}] 的情感纽带/宿命契约！`);
  };

  // 5. Delete specific relationship bond
  const handleDeleteRelationship = (sourceId: string, targetName: string) => {
    const { characters } = projectData;
    const sourceChar = characters.find(c => c.id === sourceId);
    if (!sourceChar || !confirm(`真的确定要剪断此情感纽带羁绊吗？`)) return;

    const updatedCharacters = characters.map((c) => {
      if (c.id === sourceId) {
        const nextRels = { ...(c.relationships || {}) };
        delete nextRels[targetName];
        return {
          ...c,
          relationships: nextRels
        };
      }
      // Also check reverse if defined
      const targetChar = characters.find(ch => ch.name === targetName);
      if (targetChar && c.id === targetChar.id && c.relationships[sourceChar.name]) {
        const nextRels = { ...(c.relationships || {}) };
        delete nextRels[sourceChar.name];
        return {
          ...c,
          relationships: nextRels
        };
      }
      return c;
    });

    onUpdateCharacters(updatedCharacters);
    setSelectedNode(null);
    setSelectedLink(null);
    alert('✨ 羁绊已断，人物纠纷及冲突指数已归零！');
  };

  // Get active relation statistics
  const totalCharactersCount = projectData.characters.length;
  // Count how many relationships are defined across all chars
  const activeBondsCount = graphData.links.length;
  
  // Calculate Avg Conflict of all links
  const averageConflict = activeBondsCount > 0 
    ? Math.round(graphData.links.reduce((sum, l) => sum + l.conflict, 0) / activeBondsCount)
    : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-950 p-5 rounded-2xl border border-slate-800 shadow-2xl relative overflow-hidden">
      
      {/* LEFT COLUMN: D3 INTERACTIVE CANVAS (7/12 cols) */}
      <div className="lg:col-span-8 flex flex-col space-y-4">
        
        {/* Graph Header Metrics */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="bg-amber-500/15 p-1.5 rounded-lg text-amber-400">
              <Activity size={18} className="animate-pulse" />
            </span>
            <div>
              <h4 className="text-sm font-bold text-slate-100 font-serif flex items-center gap-2">
                人物关系冲突态势网络图
              </h4>
              <p className="text-[11px] text-slate-500">
                黄(黄金主角) / 绯红(夙敌矛盾) / 苍蓝(配角群像) · 拖动节点可自定义排列
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1">
              <span className="text-slate-500">成员:</span>
              <span className="text-slate-200 font-bold">{totalCharactersCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-slate-500">宿命连线:</span>
              <span className="text-amber-400 font-bold">{activeBondsCount}</span>
            </div>
            {activeBondsCount > 0 && (
              <div className="flex items-center gap-1.5 bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded border border-rose-500/20">
                <Flame size={12} className="shrink-0" />
                <span className="text-[10px]">平均冲突:</span>
                <span className="font-bold">{averageConflict}%</span>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic D3 Web Frame Container with sizing monitor */}
        <div 
          ref={containerRef}
          className="relative bg-slate-900 border border-slate-800/80 rounded-xl overflow-hidden shadow-inner flex items-center justify-center min-h-[480px]"
        >
          {totalCharactersCount === 0 ? (
            <div className="text-center p-8 space-y-3">
              <Users size={48} className="text-slate-650 mx-auto" />
              <div className="space-y-1">
                <h5 className="font-bold text-slate-350 text-sm">虚空世界，暂无人物</h5>
                <p className="text-xs text-slate-500 leading-relaxed max-w-sm">
                  请先在上面【名家班底角色库】中一键召唤或手工录入几名小说角色，他们就会降临到下方，自动建立羁绊态势网。
                </p>
              </div>
            </div>
          ) : (
            <svg 
              ref={svgRef}
              width={dimensions.width}
              height={dimensions.height}
              className="w-full h-full block"
            />
          )}

          {/* Floaters zoom controller buttons on graph corner */}
          {totalCharactersCount > 0 && (
            <div className="absolute bottom-4 right-4 flex flex-col gap-2">
              <button 
                onClick={resetZoom}
                className="bg-slate-950 hover:bg-slate-850 text-slate-300 hover:text-white border border-slate-800 rounded-lg p-2 text-xs font-semibold shadow-lg transition-colors flex items-center justify-center gap-1 shrink-0"
                title="重置视角 (Fit layout)"
              >
                <Maximize2 size={13} />
                <span className="text-[10px]">重置比例</span>
              </button>
            </div>
          )}

          {/* Quick interactive hint badge */}
          {totalCharactersCount > 0 && (
            <div className="absolute top-4 left-4 bg-slate-950/80 backdrop-blur-sm border border-slate-850 px-2.5 py-1 rounded-md text-[10px] text-slate-400 flex items-center gap-1.5 pointer-events-none select-none shadow">
              <MousePointer size={11} className="text-amber-500 animate-bounce" />
              <span>双指缩放 · 点击节点/连线交互</span>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: CONTROL PANEL, RELATION DETAILS & SLIDERS (5/12 cols) */}
      <div className="lg:col-span-4 flex flex-col bg-slate-900/60 rounded-xl border border-slate-800 p-4 space-y-4">
        
        {/* Navigation for details tabs */}
        <div className="flex border-b border-slate-800 pb-0.5">
          <button
            onClick={() => setPanelTab('info')}
            className={`flex-1 pb-2 text-xs font-bold transition-all border-b-2 text-center ${
              panelTab === 'info' 
                ? 'border-amber-500 text-amber-400' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {selectedNode ? '👤 角色档案' : selectedLink ? '⚡ 关系详情' : '🔎 态势概览'}
          </button>
          
          <button
            onClick={() => setPanelTab('editor')}
            className={`flex-1 pb-2 text-xs font-bold transition-all border-b-2 text-center ${
              panelTab === 'editor' 
                ? 'border-amber-500 text-amber-400' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="flex items-center justify-center gap-1">
              <Sliders size={12} />
              {selectedLink ? '修改羁绊' : '编辑羁绊'}
            </span>
          </button>

          <button
            onClick={() => setPanelTab('help')}
            className={`flex-c pb-2 text-xs font-bold px-3 transition-all border-b-2 text-center ${
              panelTab === 'help' 
                ? 'border-amber-500 text-amber-400' 
                : 'border-transparent text-slate-450 hover:text-slate-200'
            }`}
          >
            <HelpCircle size={14} className="mx-auto" />
          </button>
        </div>

        {/* TAB CONTENTS CONTAINER */}
        <div className="flex-1 flex flex-col justify-start min-h-[360px] max-h-[500px] overflow-y-auto pr-1">
          
          {/* TABS: 1. DETAILS PANEL (SHOWS STATIC SUMMARY OR SELECTION DATA) */}
          {panelTab === 'info' && (
            <div className="space-y-4 flex-1 flex flex-col justify-between">
              
              {/* STATE A: Selective NODE clicked */}
              {selectedNode ? (
                <div className="space-y-4">
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        selectedNode.role === 'protagonist' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        selectedNode.role === 'antagonist' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                        'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      }`}>
                        {selectedNode.role === 'protagonist' ? '核心主角' : selectedNode.role === 'antagonist' ? '宿命死敌' : '重要配角'}
                      </span>
                      <span className="text-[11px] text-slate-500">{selectedNode.gender} · {selectedNode.age}岁</span>
                    </div>
                    
                    <h5 className="font-serif font-bold text-slate-100 text-lg">{selectedNode.name}</h5>
                    <p className="text-[11px] text-amber-400 font-mono italic">“{selectedNode.character.catchphrase || '行乾坤，行无阻！'}”</p>
                  </div>

                  {/* Node Profile Fields */}
                  <div className="space-y-3.5 text-xs">
                    <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-800/40 space-y-1">
                      <span className="text-[10px] text-amber-500 font-semibold block">【外貌特征、神韵衣着】</span>
                      <p className="text-slate-300 leading-relaxed leading-[1.4]">{selectedNode.character.appearance}</p>
                    </div>

                    <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-800/40 space-y-1">
                      <span className="text-[10px] text-amber-500 font-semibold block">【性格矛盾特质】</span>
                      <p className="text-slate-350 leading-relaxed leading-[1.4]">{selectedNode.character.personality}</p>
                    </div>

                    <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-800/40 space-y-1">
                      <span className="text-[10px] text-amber-500 font-semibold block">【终极欲望/挣扎执念】</span>
                      <p className="text-slate-300 leading-relaxed leading-[1.4]">{selectedNode.character.goal}</p>
                    </div>
                  </div>

                  {/* Connected relationships direct list */}
                  <div className="pt-2">
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block border-b border-slate-800 pb-1.5 mb-2">
                      与此角色直接关联的羁绊 ({Object.keys(selectedNode.character.relationships || {}).length})
                    </span>
                    
                    {Object.keys(selectedNode.character.relationships || {}).length === 0 ? (
                      <p className="text-[11px] text-slate-500 italic py-2">目前他似乎在江湖上孤立无援，暂未建立外部关系契约。</p>
                    ) : (
                      <div className="space-y-2">
                        {Object.entries(selectedNode.character.relationships || {}).map(([targetName, relVal]) => {
                          const parsed = parseRelationship(relVal as string);
                          return (
                            <div 
                              key={targetName}
                              className="bg-slate-950 p-2.5 rounded-lg border border-slate-805 flex flex-col gap-2 hover:border-slate-700 transition-colors"
                            >
                              <div className="flex items-center justify-between font-medium">
                                <span className="text-xs text-slate-200">
                                  {selectedNode.name} ──&gt; <strong className="text-amber-400">{targetName}</strong>
                                </span>
                                <button
                                  onClick={() => handleDeleteRelationship(selectedNode.id, targetName)}
                                  className="text-[10px] text-slate-500 hover:text-rose-400 shrink-0 p-1 rounded hover:bg-rose-500/10"
                                  title="剪断此线"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>

                              <p className="text-[11px] text-slate-400 leading-relaxed bg-slate-900/40 px-2 py-1 rounded">
                                {parsed.description}
                              </p>

                              {/* Progress rates display info */}
                              <div className="grid grid-cols-2 gap-3 text-[10px] pt-1">
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-slate-500">
                                    <span className="flex items-center gap-0.5"><Heart size={9} className="text-emerald-400" /> 亲密度:</span>
                                    <span className="text-slate-300 font-semibold">{parsed.connection}%</span>
                                  </div>
                                  <div className="bg-slate-850 rounded-full h-1">
                                    <div className="bg-emerald-500 h-1 rounded-full" style={{ width: `${parsed.connection}%` }} />
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-slate-500">
                                    <span className="flex items-center gap-0.5"><Flame size={9} className="text-rose-400" /> 冲突度:</span>
                                    <span className="text-slate-300 font-semibold">{parsed.conflict}%</span>
                                  </div>
                                  <div className="bg-slate-850 rounded-full h-1">
                                    <div className="bg-rose-500 h-1 rounded-full" style={{ width: `${parsed.conflict}%` }} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : selectedLink ? (
                /* STATE B: Selective LINK clicked */
                <div className="space-y-4">
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                    <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide bg-amber-500/10 text-amber-400">
                      羁绊连线卡
                    </span>
                    <h5 className="font-serif font-bold text-slate-100 text-base">
                      {selectedLink.sourceName} <span className="text-amber-500">⇹</span> {selectedLink.targetName}
                    </h5>
                  </div>

                  {/* Rates sliders display in card */}
                  <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800 space-y-4">
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">
                      羁绊属性强度评测
                    </span>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1 text-slate-400">
                          <Heart size={12} className="text-emerald-400" />
                          关联亲密指数
                        </span>
                        <strong className="text-emerald-400 font-mono">{selectedLink.connection}%</strong>
                      </div>
                      <div className="bg-slate-800 rounded-full h-2">
                        <div className="bg-gradient-to-r from-emerald-600 to-emerald-400 h-2 rounded-full" style={{ width: `${selectedLink.connection}%` }} />
                      </div>
                      <p className="text-[10px] text-slate-500 leading-normal">
                        关联度越高，双方气场越吸纳，在联合大纲生成时双方并肩作战、共同推进世界观的机率就越高。
                      </p>
                    </div>

                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1 text-slate-400">
                          <Flame size={12} className="text-rose-400" />
                          剧情冲突指数
                        </span>
                        <strong className="text-rose-400 font-mono">{selectedLink.conflict}%</strong>
                      </div>
                      <div className="bg-slate-800 rounded-full h-2">
                        <div className="bg-gradient-to-r from-rose-600 to-rose-400 h-2 rounded-full" style={{ width: `${selectedLink.conflict}%` }} />
                      </div>
                      <p className="text-[10px] text-slate-500 leading-normal">
                        冲突值高（&gt;50%）的角色在线条上呈现红虚线搏动。他们不仅有着意识鸿沟，还有可能在章节草稿中上演相互背叛与追杀反扑。
                      </p>
                    </div>
                  </div>

                  {/* Desc detail box */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-805 space-y-2">
                    <span className="text-[10px] text-slate-500 font-bold block">宿命纽带详情：</span>
                    <p className="text-xs text-slate-200 leading-relaxed leading-[1.5] bg-slate-900 border border-slate-850 p-2.5 rounded-lg">
                      {selectedLink.relationText}
                    </p>
                  </div>

                  {/* Actions buttons under selective link details */}
                  <div className="flex gap-2 pt-2 text-xs">
                    <button
                      onClick={() => {
                        setFormSourceId(selectedLink.sourceId);
                        setFormTargetId(selectedLink.targetId);
                        setFormRelationText(selectedLink.relationText);
                        setFormConnection(selectedLink.connection);
                        setFormConflict(selectedLink.conflict);
                        setPanelTab('editor');
                      }}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-750 py-2 px-3 rounded flex items-center justify-center gap-1 font-medium select-none"
                    >
                      <Edit size={12} />
                      修改此羁绊
                    </button>
                    <button
                      onClick={() => handleDeleteRelationship(selectedLink.sourceId, selectedLink.targetName)}
                      className="bg-rose-550 hover:bg-rose-500 text-slate-300 hover:text-white border border-rose-500/20 py-2 px-3 rounded text-[11px] font-bold shrink-0 text-rose-400"
                    >
                      斩断关系
                    </button>
                  </div>
                </div>
              ) : (
                /* STATE C: NO ELEMENT CLICKED, SHOW STATIC LEGEND & ADVICE GUIDE */
                <div className="space-y-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="bg-amber-500/5 border border-amber-500/10 p-3.5 rounded-xl space-y-1.5 shadow-sm text-xs">
                      <h6 className="font-bold text-amber-400 font-serif flex items-center gap-1 text-[13px]">
                        <Sparkles size={13} className="shrink-0" />
                        动态态势图使用说明
                      </h6>
                      <p className="text-slate-400 leading-relaxed leading-[1.4] text-[11px]">
                        小说圣经与剧情大纲要生动，必须有多样化的角色羁绊制约。
                        点击下方图形，我们将展示核心角色的神海执念；鼠标触击连线可窥测他们私密的心境立场。
                      </p>
                    </div>

                    {/* Dynamic legend guide card */}
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 text-xs">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">图例立场说明：</span>
                      
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <span className="h-3 w-3 rounded-full bg-amber-500 ring-2 ring-amber-500/30 shrink-0" />
                          <span className="text-slate-300 font-medium">黄金主角 (大型节点) ── 全书核心枢纽</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="h-3 w-3 rounded-full bg-rose-500 ring-2 ring-rose-500/30 shrink-0" />
                          <span className="text-slate-300 font-medium">宿命反派对立者 (中型节点) ── 提供极深危机</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="h-3 w-3 rounded-full bg-sky-500 ring-2 ring-sky-500/30 shrink-0" />
                          <span className="text-slate-300 font-medium">同盟黄金配角群 (标准节点) ── 辅助剧情支招</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5 text-xs">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">连线与搏动线索说明：</span>
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <span className="h-0.5 w-6 bg-emerald-500 shrink-0" />
                          <span className="text-slate-300 text-[11px]">友好合作线 (高亲密、低冲突) ─ 坚固盟友</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="h-0.5 w-6 bg-slate-500 shrink-0" />
                          <span className="text-slate-300 text-[11px]">常规普通关系 (低关联、低冲突) ── 萍水相知</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="h-0.5 w-6 bg-rose-500 border-dashed style border-spacing-1 shrink-0" style={{ backgroundImage: 'linear-gradient(to right, #f43f5e 50%, transparent 50%)', backgroundSize: '6px 2px', backgroundRepeat: 'repeat-x' }} />
                          <span className="text-rose-400 text-[11px] animate-pulse">流速红虚线 (高冲突率) ── 【杀意搏动/反目张力】</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 flex items-start gap-2.5 text-[11px] text-slate-500">
                    <Info size={14} className="text-amber-500 shrink-0 mt-0.5" />
                    <span>
                      您可以随时在上方“名家班底角色库”增加新配角。增加完后系统将在此地自动注册绘制。
                    </span>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TABS: 2. EDITOR PANEL (FORGING RELATIONSHIPS FORM) */}
          {panelTab === 'editor' && (
            <form onSubmit={handleSaveRelationship} className="space-y-4 flex-1 flex flex-col justify-between">
              
              {totalCharactersCount < 2 ? (
                <div className="text-center py-10 space-y-3">
                  <AlertCircle className="text-amber-500 mx-auto" size={28} />
                  <p className="text-xs text-slate-400">关系连线至少需要 2 位不同的角色方可拉线构筑。请先添加更多配角！</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-805 text-xs text-slate-400">
                    <span className="text-amber-400 font-bold block mb-1">🎭 主动编配宿命纽带：</span>
                    您可以在此手工配置两个角色之间的感情立场，设定好之后立即反映在左侧D3流式态势网络图中，并可在章节草稿撰稿时由 AI 检索读取！
                  </div>

                  {/* Character selection pairs */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 uppercase font-semibold">角色源头 Source</span>
                      <select 
                        value={formSourceId} 
                        onChange={(e) => setFormSourceId(e.target.value)} 
                        className="w-full bg-slate-950 rounded border border-slate-800 text-slate-200 px-2 py-2 mt-1 focus:outline-none focus:border-amber-500 text-xs"
                      >
                        {projectData.characters.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <span className="text-slate-500 uppercase font-semibold">角色对象 Target</span>
                      <select 
                        value={formTargetId} 
                        onChange={(e) => setFormTargetId(e.target.value)} 
                        className="w-full bg-slate-950 rounded border border-slate-805 text-slate-200 px-2 py-2 mt-1 focus:outline-none focus:border-amber-500 text-xs"
                      >
                        {projectData.characters
                          .filter(c => c.id !== formSourceId)
                          .map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                      </select>
                    </div>
                  </div>

                  {/* Sliders rates selectors */}
                  <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs">
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-semibold flex items-center gap-1">
                          <Heart size={11} className="text-emerald-400" />
                          关联亲密指数 Connection
                        </span>
                        <strong className="text-emerald-400 font-mono text-[11px]">{formConnection}%</strong>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={formConnection} 
                        onChange={(e) => setFormConnection(Number(e.target.value))}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 mt-1" 
                      />
                    </div>

                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-semibold flex items-center gap-1">
                          <Flame size={11} className="text-rose-450" />
                          剧情冲突指数 Hostility
                        </span>
                        <strong className="text-rose-400 font-mono text-[11px]">{formConflict}%</strong>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={formConflict} 
                        onChange={(e) => setFormConflict(Number(e.target.value))}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500 mt-1" 
                      />
                    </div>
                  </div>

                  {/* Relationship desc details */}
                  <div className="space-y-1.5 text-xs">
                    <span className="text-slate-500 font-semibold">【情感羁绊/世俗角力关系描述】</span>
                    <textarea 
                      value={formRelationText}
                      onChange={(e) => setFormRelationText(e.target.value)}
                      rows={3}
                      placeholder="例如: 表面上是同门师兄弟，但其实因掌舵长老的传承引发暗中猜忌，主角对其抱有50%警惕。"
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-slate-200 focus:outline-none focus:border-amber-500 resize-none font-sans"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Form submit footer button */}
              {totalCharactersCount >= 2 && (
                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold py-2 rounded-lg text-xs shadow-lg shadow-amber-500/5 cursor-pointer hover:shadow-md hover:shadow-amber-500/10 active:scale-[0.99] transition-all select-none"
                >
                  确认落款关系纽带
                </button>
              )}
            </form>
          )}

          {/* TABS: 3. HELP CENTER */}
          {panelTab === 'help' && (
            <div className="space-y-4 text-xs select-none">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5">
                <h6 className="font-serif font-bold text-slate-205 text-sm flex items-center gap-1">
                  <TrendingUp size={14} className="text-amber-500" />
                  关系羁绊与大模型检索协同
                </h6>
                <p className="text-slate-400 leading-relaxed text-[11px] leading-[1.45]">
                  你在这里定义的每一个关系都会存储在角色的 <code>relationships</code> 数据列中。
                </p>
                <p className="text-slate-400 leading-relaxed text-[11px] leading-[1.45]">
                  当你在【章节撰写】中撰写特定大纲出现的剧情章节时，
                  大模型会<strong>自动索引当前出场人物的脾气、执念、以及彼此在这张表中配置的防备度或爱慕系数</strong>。
                </p>
                <p className="text-slate-400 leading-relaxed text-[11px] leading-[1.45]">
                  由此生成的对白、微表情会完全契合这里的宿命线！例如冲突指数 &gt; 80% 的角色，在情节里遭遇时，大模型会默认推进激烈冲突搏杀，极大避免了逻辑低智行为！
                </p>
              </div>

              <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/40 space-y-2">
                <span className="font-semibold text-slate-300 block">我可以随意修改吗？</span>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  当然。您可以直接用连线卡或手工Sliders在“修改羁绊”中重新调节，点击“重置视角”可优化排版排列。大模型在下一章节中就会采娜并融入您的微调成果！
                </p>
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
