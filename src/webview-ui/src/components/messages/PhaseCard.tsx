import type { Message } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle2 } from 'lucide-react'

const phaseLabels: Record<string, { title: string; btn: string }> = {
  goal: { title: '确认目标', btn: '确认目标' },
  plan: { title: '制定计划', btn: '确认计划' },
  execute: { title: '执行', btn: '确认执行完成' },
  self_verify: { title: '自我验证', btn: '确认自验完成' },
  review: { title: '验收', btn: '验收通过' },
}

const vsCode = (window as any).vscode

export default function PhaseCard({ phaseAction, taskId }: Message) {
  if (!phaseAction) return null
  const info = phaseLabels[phaseAction.phase]
  if (!info) return null

  const confirmed = phaseAction.status === 'confirmed'
  const rejected = phaseAction.status === 'rejected'

  const handleClick = () => {
    if (confirmed || rejected) return
    const actionMap: Record<string, string> = {
      goal: 'confirmGoal',
      plan: 'confirmPlan',
      execute: 'confirmExecuteDone',
      self_verify: 'confirmSelfVerifyDone',
      review: 'approveReview',
    }
    const action = actionMap[phaseAction.phase]
    if (action && vsCode) {
      vsCode.postMessage({ type: action, taskId })
    }
  }

  return (
    <div className="flex justify-start mb-3">
      <Card className="w-full max-w-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={confirmed ? 'default' : 'outline'}>
                {info.title}
              </Badge>
              {confirmed && (
                <span className="text-xs text-green-500 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 已确认
                </span>
              )}
              {rejected && (
                <span className="text-xs text-red-500">已驳回</span>
              )}
            </div>
            {!confirmed && !rejected && (
              <Button size="sm" onClick={handleClick}>
                {info.btn}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
