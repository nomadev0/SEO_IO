export function Skeleton({ className='' }:{ className?:string }){
return <div className={`animate-pulse bg-gray-200/70 dark:bg-white/10 rounded-xl ${className}`} />
}