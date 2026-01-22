import { View, Text, StyleSheet, Animated, Easing } from "react-native";
import { useRef, useEffect, useState } from "react";
import Svg, { G, Path, Text as SvgText, Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { colors } from "@/lib/theme";

interface WheelSegment {
  id: string;
  label: string;
  color: string;
  value?: number;
}

interface FamilyWheelProps {
  segments: WheelSegment[];
  spinning: boolean;
  onSpinComplete: (segment: WheelSegment) => void;
  size?: number;
  spinDuration?: number;
}

const PASTEL_COLORS = [
  "#FFB5BA", // Pink
  "#B5E8C3", // Green  
  "#FFE5A0", // Yellow
  "#B5D8FF", // Blue
  "#E5B5FF", // Purple
  "#FFD5B5", // Orange
  "#B5FFE5", // Mint
  "#FFB5E5", // Rose
];

export function FamilyWheel({ 
  segments, 
  spinning, 
  onSpinComplete, 
  size = 280,
  spinDuration = 3000 
}: FamilyWheelProps) {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const prevSpinning = useRef(false);

  const radius = size / 2;
  const centerX = radius;
  const centerY = radius;
  const innerRadius = radius * 0.15;

  useEffect(() => {
    if (spinning && !prevSpinning.current && segments.length > 0) {
      const randomIndex = Math.floor(Math.random() * segments.length);
      setSelectedIndex(randomIndex);
      
      const segmentAngle = 360 / segments.length;
      const targetAngle = 360 - (randomIndex * segmentAngle + segmentAngle / 2);
      const totalRotation = 360 * 5 + targetAngle;

      rotateAnim.setValue(0);
      Animated.timing(rotateAnim, {
        toValue: totalRotation,
        duration: spinDuration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        onSpinComplete(segments[randomIndex]);
      });
    }
    prevSpinning.current = spinning;
  }, [spinning, segments]);

  const createWedgePath = (index: number, total: number): string => {
    const angle = 360 / total;
    const startAngle = index * angle - 90;
    const endAngle = startAngle + angle;
    
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    
    const x1 = centerX + (radius - 10) * Math.cos(startRad);
    const y1 = centerY + (radius - 10) * Math.sin(startRad);
    const x2 = centerX + (radius - 10) * Math.cos(endRad);
    const y2 = centerY + (radius - 10) * Math.sin(endRad);
    
    const ix1 = centerX + innerRadius * Math.cos(startRad);
    const iy1 = centerY + innerRadius * Math.sin(startRad);
    const ix2 = centerX + innerRadius * Math.cos(endRad);
    const iy2 = centerY + innerRadius * Math.sin(endRad);
    
    const largeArcFlag = angle > 180 ? 1 : 0;
    
    return `M ${ix1} ${iy1} L ${x1} ${y1} A ${radius - 10} ${radius - 10} 0 ${largeArcFlag} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${ix1} ${iy1} Z`;
  };

  const getTextPosition = (index: number, total: number) => {
    const angle = 360 / total;
    const midAngle = index * angle + angle / 2 - 90;
    const midRad = (midAngle * Math.PI) / 180;
    const textRadius = radius * 0.6;
    
    return {
      x: centerX + textRadius * Math.cos(midRad),
      y: centerY + textRadius * Math.sin(midRad),
      rotation: midAngle + 90,
    };
  };

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ["0deg", "360deg"],
  });

  if (segments.length === 0) {
    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <View style={styles.emptyWheel}>
          <Text style={styles.emptyText}>No members yet</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { width: size, height: size + 40 }]}>
      <View style={styles.pointer}>
        <View style={styles.pointerTriangle} />
      </View>
      
      <View style={styles.wheelFrame}>
        <Animated.View style={{ transform: [{ rotate: rotation }] }}>
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <Defs>
              <LinearGradient id="wheelBorder" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#FFD700" />
                <Stop offset="50%" stopColor="#FFA500" />
                <Stop offset="100%" stopColor="#FFD700" />
              </LinearGradient>
            </Defs>
            
            <Circle 
              cx={centerX} 
              cy={centerY} 
              r={radius - 5} 
              fill="none" 
              stroke="url(#wheelBorder)" 
              strokeWidth={8} 
            />
            
            <G>
              {segments.map((segment, index) => (
                <Path
                  key={segment.id}
                  d={createWedgePath(index, segments.length)}
                  fill={segment.color || PASTEL_COLORS[index % PASTEL_COLORS.length]}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                />
              ))}
            </G>
            
            <G>
              {segments.map((segment, index) => {
                const pos = getTextPosition(index, segments.length);
                const displayLabel = segment.label.length > 8 
                  ? segment.label.substring(0, 7) + "…" 
                  : segment.label;
                return (
                  <SvgText
                    key={`text-${segment.id}`}
                    x={pos.x}
                    y={pos.y}
                    fill="#5D4037"
                    fontSize={segments.length > 6 ? 12 : 14}
                    fontWeight="bold"
                    textAnchor="middle"
                    alignmentBaseline="middle"
                    transform={`rotate(${pos.rotation}, ${pos.x}, ${pos.y})`}
                  >
                    {displayLabel}
                  </SvgText>
                );
              })}
            </G>
            
            <Circle 
              cx={centerX} 
              cy={centerY} 
              r={innerRadius + 5} 
              fill="#FFF8E1" 
              stroke="#FFD700"
              strokeWidth={3}
            />
          </Svg>
        </Animated.View>
      </View>
      
      <View style={styles.wheelStand}>
        <View style={styles.standBase} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  wheelFrame: {
    borderRadius: 999,
    padding: 5,
    backgroundColor: "#FFF8E1",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  pointer: {
    position: "absolute",
    top: 0,
    zIndex: 10,
    alignItems: "center",
  },
  pointerTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 15,
    borderRightWidth: 15,
    borderBottomWidth: 30,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#FFD700",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  wheelStand: {
    position: "absolute",
    bottom: 0,
    alignItems: "center",
  },
  standBase: {
    width: 80,
    height: 20,
    backgroundColor: "#8BC34A",
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  emptyWheel: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 8,
    borderColor: "#E0E0E0",
  },
  emptyText: {
    color: "#9E9E9E",
    fontSize: 16,
  },
});
